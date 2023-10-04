const core = require('@actions/core');
const { format, utcToZonedTime } = require('date-fns-tz');
const timezone = core.getInput('timezone') || 'Etc/UTC';
const formatDistance = require('date-fns/formatDistance');

function getMarkupForJson(jsonResults, reportName) {
  return `
# ${reportName}
${getBadge(jsonResults.stats.requests, 'Requests')}
${getBadge(jsonResults.stats.assertions, 'Assertions')}
${getTestTimes(jsonResults.timings)}
${getTestCounters(jsonResults)}
${getTestResultsMarkup(jsonResults.failures, reportName)}
  `;
}

function getBadge(stats, name) {
  const failedCount = stats.failed;
  const totalCount = stats.total;
  const passedCount = totalCount - failedCount;

  const badgeCountText = failedCount > 0 ? `\x1b[31m${failedCount}/${totalCount}\x1b[0m` : `\x1b[32m${passedCount}/${totalCount}\x1b[0m`; // Red for FAILED, Green for PASSED
  const badgeStatusText = failedCount > 0 ? '\x1b[31mFAILED\x1b[0m' : '\x1b[32mPASSED\x1b[0m'; // Red for FAILED, Green for PASSED

  //return `${name}_${badgeCountText}-${badgeStatusText}`;

  const styledText = `${name}_${badgeCountText}-${badgeStatusText}`;
  
  // Apply CSS font style to the styledText
  const styledOutput = `<span style="font-family: Verdana;">${styledText}</span>`;
  
  return styledOutput;
}

function formatDate(dateToFormat) {
  if (timezone && timezone.length > 0) {
    let dateWithTimezone = utcToZonedTime(dateToFormat, timezone);
    return `${format(dateWithTimezone, 'yyyy-MM-dd HH:mm:ss.SSS zzz', { timeZone: timezone })}`;
  } else {
    return format(dateToFormat, 'yyyy-MM-dd HH:mm:ss.SSS zzz');
  }
}

function getEntryValue(value) {
  let valueArray = Array.isArray(value) ? value : [value];
  const [val, wrapper] = valueArray;
  if (!val) return '';

  return wrapper ? `<${wrapper}>${val}</${wrapper}>` : val;
}

function getTableEntry(title, ...values) {
  const tableValues = values.map(getEntryValue);
  if (!tableValues.some(val => val)) return '';

  return `
<tr>
  <th>${title}</th>
  ${tableValues.map(val => `<td>${val}</td>`).join('')}
</tr>
`;
}

function getTestTimes(timings) {
  const startDate = new Date(timings.started);
  const endDate = new Date(timings.completed);
  const duration = formatDistance(endDate, startDate, {
    includeSeconds: true
  });

  return `
<details>
  <summary> Duration: ${duration} </summary>
  <table>
    ${getTableEntry('Start:', [formatDate(startDate), 'code'])}
    ${getTableEntry('Finish:', [formatDate(endDate), 'code'])}
    ${getTableEntry('Duration:', [`${(timings.completed - timings.started) / 1000}`, 'code'])}
    ${getTableEntry('Response Time Average:', [timings?.responseAverage, 'code'])}
    ${getTableEntry('Response Time Min:', [timings?.responseMin, 'code'])}
    ${getTableEntry('Response Time Max:', [timings?.responseMax, 'code'])}
  </table>
</details>
  `;
}

function getTestCounters(run) {
  let stats = run.stats;
  return `
<details>
  <summary> Outcome: ${run.outcome}</summary>
  <table>
    <tr>
      <th></th>
      <th>executed</th>
      <td>failed</td>
    </tr>
    ${getTableEntry('iterations', stats?.iterations?.total, stats?.iterations?.failed)}
    ${getTableEntry('requests', stats?.requests?.total, stats?.requests?.failed)}
    ${getTableEntry('test-scripts', stats?.testScripts?.total, stats?.testScripts?.failed)}
    ${getTableEntry('prerequest-scripts', stats?.prerequestScripts?.total, stats?.prerequestScripts?.failed)}
    ${getTableEntry('assertions', stats?.assertions?.total, stats?.assertions?.failed)}
  </table>
</details>

  `;
}

function getTestResultsMarkup(failures, reportName) {
  let resultsMarkup = '';

  if (!failures || failures.length === 0) {
    return getNoResultsMarkup(reportName);
  } else {
    failures.forEach(failure => {
      resultsMarkup += getFailureMarkup(failure);
    });
    return resultsMarkup.trim();
  }
}

function getNoResultsMarkup(reportName) {
  const testResultIcon = ':grey_question:';
  const resultsMarkup = `
  ## ${testResultIcon} ${reportName}
  There were no failures to report.
  `;
  return resultsMarkup;
}

function getFailureMarkup(failure) {
  if (!failure) return;

  core.debug(`Processing ${failure.error.test}`);

  return `
<details>
  <summary>:x: ${failure.error?.test || failure.source?.name}</summary>
  <table>
    ${getTableEntry('Error Type:', [failure.error?.name, 'code'])}
    ${getTableEntry('Timestamp:', [failure.error?.timestamp, 'code'])}
    ${getTableEntry('Source name:', [failure.source?.name, 'code'])}
    ${getTableEntry('Path:', [failure.source?.request?.url?.path?.join('/'), 'code'])}
    ${getTableEntry('Stack:', [failure.error?.stack, 'pre'])}
  </table>
</details>
  `.trim();
}

module.exports = {
  getMarkupForJson
};
