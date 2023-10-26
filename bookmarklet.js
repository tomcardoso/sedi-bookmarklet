(function() {

  const reportUrl = window.location.pathname.replace('/sedi/', '');

  let reportType;

  switch (reportUrl) {
    case 'SVTIIBIviewResults':
      reportType = 'insiderByIssuer';
      break;
    case 'SVTItdSelectInsider':
    case 'SVTItdSelectIssuer':
      reportType = 'insiderTransactionDetail';
      break;
  }

  // If format doesn't match either page, we're done
  if (!reportType) return;

  let pageType,
    template,
    hasRemarks = false;

  const issuerNameRegex = /^Issuer name:.*/i,
    insiderNameRegex = /^Insider name:.*/i,
    insiderRelationshipRegex = /^Insider's Relationship to Issuer:|Insider Relationship:.*/i,
    ceasedToBeInsiderRegex = /^Ceased to be Insider:.*/i,
    securityDesignationRegex = /^Security designation:.*/i,
    endRegex = /^To download this information.*/,
    hasRemarksRegex = /^Do you want to view transactions.*/,
    generalRemarksRegex = /^General remarks:.*/,
    transactionIdRegex = /^Transaction ID.*/,
    lastReportedTransactionRegex = /^Date of Last ReportedTransaction.*/;

  const ignoreRows = [
    "Legend: O - Original transaction, A - First amendment to transaction, A' - Second amendment to transaction, AP - Amendment to paper filing, etc.",
    "Insider's Relationship to Issuer: 1 - Issuer, 2 - Subsidiary of Issuer, 3 - 10% Security Holder of Issuer, 4 - Director of Issuer, 5 - Senior Officer of Issuer, 6 - Director or Senior Officer of 10% Security Holder, 7 - Director or Senior Officer of Insider or Subsidiary of Issuer (other than in 4,5,6), 8 - Deemed Insider - 6 Months before becoming Insider.",
    'Warning: The closing balance of the " equivalent number or value of underlying securities" reflects the" total number or value of underlying securities" to which the derivative contracts held by the insider relate. This disclosure does not mean and should not be taken to indicate that the underlying securities have, in fact, been acquired or disposed of by the insider.',
    'Do you want to view transactions with remarks?',
    // "Transaction ID Date of transactionYYYY-MM-DD Date of filingYYYY-MM-DD Ownership type (and registered holder, if applicable) Nature of transaction Number or value acquired or disposed of Unit price or exercise price Closing balance Insider's calculated balance Conversionor exerciseprice Date of expiry or maturityYYYY-MM-DD Underlying security designation Equivalent number or value of underlying securities acquired or disposed of Closing balance of equivalent number or value of underlying securities"
  ];

  const header = [];

  if (reportType === 'insiderByIssuer') {
    header.push(
      'Issuer name',
      'Insider name',
      'Insider Relationship',
      'Ceased to be Insider',
      // 'Date of last reported transaction',
      // 'Security designation',
      // 'Registered holder',
      // 'Closing balance',
      // 'Insider\'s calculated balance',
      // 'Closing balance of equivalent number or value of underlying securities'
    );
  }

  if (reportType === 'insiderTransactionDetail') {
    header.push(
      'Issuer name',
      'Insider name',
      'Insider\'s Relationship to Issuer',
      'Ceased to be Insider',
      'Security designation',
      'Transaction type',
      // 'Transaction ID',
      // 'Date of transaction',
      // 'Date of filing',
      // 'Ownership type',
      // 'Nature of transaction',
      // 'Number or value acquired or disposed of',
      // 'Unit price or exercise price',
      // 'Unit currency, if not CAD',
      // 'Closing balance',
      // 'Insider\'s calculated balance',
      // 'Conversion or exercise price',
      // 'Date of expiry or maturity',
      // 'Underlying security designation',
      // 'Equivalent number or value of underlying securities acquired or disposed of',
      // 'Closing balance of equivalent number or value of underlying securities',
    );
  }

  const defaultHeaderColumns = header.length;

  const finalData = [];

  finalData.push(header);

  const anchor = document.createElement('a');
  anchor.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(sediBookmarklet(document))}`);
  anchor.setAttribute('download', constructFilename());
  anchor.click();
  anchor.remove();

  function jsonToCSV(objArray, config) {
    const defaults = {
      delimiter: ',',
      newline: '\n'
    };
    const opt = config || defaults;
    const array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    let str = '';

    for (let i = 0; i < array.length; i++) {
      let line = '';

      for (let j = 0; j < array[i].length; j++) {
        if (line != '') { line += opt.delimiter; }
        if (array[i][j].match(/,/)) {
          line += `"${array[i][j]}"`;
        } else {
          line += array[i][j];
        }

      }

      if (i === array.length - 1) {
        str += line;
      } else {
        str += line + opt.newline;
      }
    }
    return str;
  }

  function sediBookmarklet() {

    // grab the third anchor tag with a name attribute, which always appearss
    // right before Insider or Issuer details near the top of the page
    const indicatorAName = Array.from(document.querySelectorAll('a')).filter(d => d.hasAttribute('name'))[2];

    // use that to determine the page type, either issuer or insider
    const pageTypeEl = document
      .querySelector(`a[name='${indicatorAName.name}'] ~ table ~ table > tbody > tr > td:nth-child(1) font`);

    if (pageTypeEl === null || reportType === 'insiderByIssuer') {
      pageType = 'issuer';
    } else {
      pageType = pageTypeEl
        .textContent
        .toLowerCase()
        .replace('name:', '')
        .trim();
    }

    // if "insider"-mode report, flip header order so that insider starts first, then issuer
    if (pageType === 'insider') {
      const temp = header[0];
      header[0] = header[1];
      header[1] = temp;
    }

    const data = Array.from(document.querySelectorAll('table'))
      .filter(d => d.textContent.trim() !== '')
      .filter(d => ignoreRows.indexOf(d.textContent.trim().replace(/\s+/g, ' ')) === -1);

    // construct index of "starting" rows
    const startIndices = [];

    let endIndex;

    const firstOrderNameRegex = pageType === 'issuer' ? issuerNameRegex : insiderNameRegex;

    // Handle headers and determine when to start and end each table lookup
    data.map((d, i) => {
      const firstColumnRegex = reportType === 'insiderByIssuer' ?
        lastReportedTransactionRegex :
        transactionIdRegex;

      if (firstColumnRegex.test(d.textContent.trim())) {
        // construct our headers
        const headerValues = Array.from(d.querySelectorAll('td'))
          .map(d => d.innerText.replaceAll('\n', ' ').replaceAll('(YYYY-MM-DD)', '').replaceAll('YYYY-MM-DD', '').trim())
          .filter(d => d !== '');

        const unitPriceIdx = headerValues.indexOf('Unit price or exercise price');
        if (unitPriceIdx !== -1) headerValues.splice(unitPriceIdx + 1, 0, 'Unit currency, if not CAD');
        header.splice(header.length, 0, ...headerValues);
      }
      if (firstOrderNameRegex.test(d.textContent.trim())) startIndices.push(i);
      if (endRegex.test(d.textContent.trim())) endIndex = i;
    });

    // Since remarks come after header construction,
    // need to handle this afterwards
    data.map(d => {
      if (!hasRemarks && hasRemarksRegex.test(d.textContent.trim())) {
        const remarksTest = d.textContent.trim().indexOf('without');
        hasRemarks = remarksTest > -1;
        if (hasRemarks) header.push('General remarks');
      }
    });

    template = Array(header.length).join('.').split('.');

    startIndices.push(endIndex);

    // tables that start with either "Issuer name" or "Insider name"
    startIndices
      .map((d, i) => i !== 0 ? data.slice(startIndices[i - 1], d) : undefined)
      .filter(d => d)
      .map(d => {
        // this is where data extraction occurs, writing to the finalData object
        extractParentTable(d);
      });

    return jsonToCSV(finalData);

  }

  function extractParentTable(parentTableData) {

    let firstOrderName;

    const parentRemoveIndices = [];

    const firstOrderNameRegex = pageType === 'issuer' ? issuerNameRegex : insiderNameRegex,
      secondOrderNameRegex = pageType === 'issuer' ? insiderNameRegex : issuerNameRegex;

    parentTableData.map((row, i) => {
      const str = row.textContent.trim().replace(/\s+/g, ' '),
        strClean = str.replace(/.+:\s/, '');
      switch (true) {
        case firstOrderNameRegex.test(str):
          firstOrderName = strClean;
          parentRemoveIndices.push(i);
          break;
      }
    });

    const grayTableStartIndices = [];

    const parentTable = parentTableData
      .filter((row, i) => parentRemoveIndices.indexOf(i) === -1);

    parentTable.map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:\s/, '');
        switch (true) {
          case secondOrderNameRegex.test(str):
            grayTableStartIndices.push(i);
            break;
        }
      });

    // tables that start with the gray block
    const grayTables = grayTableStartIndices
      .map((d, i) => {
        if (i === grayTableStartIndices.length - 1) {
          return parentTable.slice(d, parentTable.length);
        } else {
          return parentTable.slice(d, grayTableStartIndices[i + 1]);
        }
      });

    grayTables.map(d => {
      extractGrayTable(d, {
        firstOrderName
      });
    });

  }

  function extractGrayTable(grayTableData, params) {

    const firstOrderName = params.firstOrderName;

    let secondOrderName,
      insiderRelationship,
      ceasedToBeInsider;

    const grayTableRemoveIndices = [];

    const secondOrderNameRegex = pageType === 'issuer' ? insiderNameRegex : issuerNameRegex;

    grayTableData
      .map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:\s/, '');
        switch (true) {
          case secondOrderNameRegex.test(str):
            secondOrderName = strClean;
            grayTableRemoveIndices.push(i);
            break;
          case insiderRelationshipRegex.test(str):
            insiderRelationship = strClean;
            grayTableRemoveIndices.push(i);
            break;
          case ceasedToBeInsiderRegex.test(str):
            ceasedToBeInsider = strClean;
            grayTableRemoveIndices.push(i);
            break;
        }
      });

    const whiteTableStartIndices = [];

    const grayTable = grayTableData
      .filter((row, i) => grayTableRemoveIndices.indexOf(i) === -1);

    // for insiderTransactionDetails pages, tables that start with "security designation" bit
    // for insiderByIssuer pages, detail tables that come after gray boxes
    let whiteTables;

    // if we're using insiderByIssuer, we can just take full grayTable
    if (reportType === 'insiderByIssuer') {
      whiteTables = [grayTable];
    } else {
      grayTable.map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' ');
        switch (true) {
          case securityDesignationRegex.test(str):
            whiteTableStartIndices.push(i);
            break;
        }
      });

      whiteTables = whiteTableStartIndices
        .map((d, i) => {
          if (i === whiteTableStartIndices.length - 1) {
            return grayTable.slice(d, grayTable.length);
          } else {
            return grayTable.slice(d, whiteTableStartIndices[i + 1]);
          }
        });
    }

    const issuerName = pageType === 'issuer' ? firstOrderName : secondOrderName,
      insiderName = pageType === 'issuer' ? secondOrderName : firstOrderName;

    whiteTables.map(d => {
      extractWhiteTable(d, {
        issuerName,
        insiderName,
        insiderRelationship,
        ceasedToBeInsider
      });
    });

  }

  function extractWhiteTable(whiteTableData, params) {

    const issuerName = params.issuerName,
      insiderName = params.insiderName,
      insiderRelationship = params.insiderRelationship,
      ceasedToBeInsider = params.ceasedToBeInsider;

    let securityDesignation;

    const whiteTableRemoveIndices = [];

    whiteTableData
      .map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:\s/, '');
        switch (true) {
          case securityDesignationRegex.test(str):
            securityDesignation = strClean;
            whiteTableRemoveIndices.push(i);
            break;
        }
      });

    const generalRemarks = whiteTableData
      .map(row => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:/, '').trim();
        switch (true) {
          case generalRemarksRegex.test(str):
            return strClean;
        }
      })
      .filter(d => d !== undefined);

    whiteTable = whiteTableData
      .filter((row, i) => whiteTableRemoveIndices.indexOf(i) === -1)
      .filter(row => !generalRemarksRegex.test(row.textContent.trim().replace(/\s+/g, ' ')))
      .map((row, i) => {

        const rowData = template.slice();

        const td = Array.from(row.querySelectorAll('tr td'))
          .map(d => d.textContent.trim());

        // if "insider"-mode report, flip row data order
        rowData[0] = pageType === 'issuer' ? issuerName : insiderName;
        rowData[1] = pageType === 'issuer' ? insiderName : issuerName;

        rowData[2] = insiderRelationship;
        rowData[3] = ceasedToBeInsider;

        if (securityDesignation) rowData[4] = securityDesignation;

        let tdSkip = 0;

        let loopStartIndex = defaultHeaderColumns - 1;

        // table structure is different for whatever reason here
        if (reportType === 'insiderByIssuer') loopStartIndex++;

        for (var j = loopStartIndex; j < rowData.length; j++) {
          // for insiderTransactionDetail pages, td[3], td[15] and td[20] are seemingly always
          // empty, likely spacers, so let's skip them and adjust the count accordingly
          if (reportType !== 'insiderByIssuer' && [6, 17, 21].indexOf(j) > -1) tdSkip++;
          const tdIndex = j - 3 + tdSkip;
          rowData[j] = td[tdIndex]
          // console.log(`rowData[${j}] equals td[${tdIndex}]`);
        }

        if (hasRemarks) rowData[rowData.length - 1] = generalRemarks[i]; // adds remarks if applicable

        finalData.push(rowData);

      });

    finalData.push(template.slice().fill(' '));

  }

  function extractDateRange() {

    let yearFromField,
      monthFromField,
      dayFromField,
      yearToField,
      monthToField,
      dayToField;

    if (reportType === 'insiderTransactionDetail') {
      yearFromField = 'YEAR_FROM_PUBLIC';
      monthFromField = 'MONTH_FROM_PUBLIC';
      dayFromField = 'DAY_FROM_PUBLIC';
      yearToField = 'YEAR_TO_PUBLIC';
      monthToField = 'MONTH_TO_PUBLIC';
      dayToField = 'DAY_TO_PUBLIC';
    }

    if (reportType === 'insiderByIssuer') {
      yearFromField = 'FROM_YEAR';
      monthFromField = 'FROM_MONTH';
      dayFromField = 'FROM_DAY';
      yearToField = 'TO_YEAR';
      monthToField = 'TO_MONTH';
      dayToField = 'TO_DAY';
    }

    if (!(yearFromField && monthFromField && dayFromField && yearToField && monthToField && dayToField)) return;

    const monthFrom = (parseInt(document.querySelector(`input[name="${monthFromField}"]`).value) + 1).toString(),
      dayFrom = document.querySelector(`input[name="${dayFromField}"]`).value,
      yearFrom = document.querySelector(`input[name="${yearFromField}"]`).value,
      monthTo = (parseInt(document.querySelector(`input[name="${monthToField}"]`).value) + 1).toString(),
      dayTo = document.querySelector(`input[name="${dayToField}"]`).value,
      yearTo = document.querySelector(`input[name="${yearToField}"]`).value;

    const fromDate = `${yearFrom}${monthFrom.padStart(2, '0')}${dayFrom.padStart(2, '0')}`,
      toDate = `${yearTo}${monthTo.padStart(2, '0')}${dayTo.padStart(2, '0')}`;

    return `${fromDate}-${toDate}`;
  }

  function extractDateRangeType() {
    if (reportType === 'insiderByIssuer') return;
    const dateRangeType = document.querySelector('input[name="DATE_RANGE_TYPE"]');
    return dateRangeType.value == 0 ? 'transactions' : 'filings';
  }

  function constructFilename() {

    let sediNameEl;

    if (reportType === 'insiderByIssuer') {
      sediNameEl = 'body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(17) > tbody > tr > td:nth-child(2)';
    } else if (reportType === 'insiderTransactionDetail') {
      sediNameEl = 'body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(15) > tbody > tr > td:nth-child(2)';
    }

    const sediName = document.querySelector(sediNameEl).textContent.trim().replace(/[^a-z0-9]/gi, ''); // need to sanitize

    const sediNumber = document.querySelector('input[name="ATTRIB_DRILL_ID"]').value;

    const sediFilename = [];

    if (sediName) sediFilename.push(sediName);
    if (sediNumber) sediFilename.push(sediNumber);

    const dateRangeType = reportType === 'insiderTransactionDetail' ?
      document.querySelector('input[name="DATE_RANGE_TYPE"]') :
      document.querySelector('body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(10)').innerText.trim().includes('Date range :');

    if (dateRangeType === null) {
      const currDate = new Date(),
        offset = currDate.getTimezoneOffset(),
        offsetDate = new Date(currDate.getTime() - (offset * 60 * 1000)),
        cleanedUpDate = offsetDate.toISOString().replace(/[-T:]/g, '').replace(/\..+/, '');
      sediFilename.push(`as_of_${cleanedUpDate}`);
    } else {
      const extractedDateRangeType = extractDateRangeType(),
        extractedDateRange = extractDateRange();

      if (extractedDateRangeType) sediFilename.push(extractedDateRangeType);
      if (extractedDateRange) sediFilename.push(extractedDateRange);
    }

    return `sedi_${sediFilename.join('_')}.csv`;
  }

})();
