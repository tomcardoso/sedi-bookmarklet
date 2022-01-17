(function() {

  let pageType, template;

  const issuerNameRegex = /^Issuer name:.*/,
    insiderNameRegex = /^Insider name:.*/,
    insiderRelationshipRegex = /^Insider's Relationship to Issuer:.*/,
    ceasedToBeInsiderRegex = /^Ceased to be Insider:.*/,
    securityDesignationRegex = /^Security designation:.*/,
    endRegex = /^To download this information.*/,
    hasRemarksRegex = /^Do you want to view transactions.*/,
    generalRemarksRegex = /^General remarks:.*/,
    transactionIdRegex = /^Transaction ID.*/;

  const ignoreRows = [
    "Legend: O - Original transaction, A - First amendment to transaction, A' - Second amendment to transaction, AP - Amendment to paper filing, etc.",
    "Insider's Relationship to Issuer: 1 - Issuer, 2 - Subsidiary of Issuer, 3 - 10% Security Holder of Issuer, 4 - Director of Issuer, 5 - Senior Officer of Issuer, 6 - Director or Senior Officer of 10% Security Holder, 7 - Director or Senior Officer of Insider or Subsidiary of Issuer (other than in 4,5,6), 8 - Deemed Insider - 6 Months before becoming Insider.",
    'Warning: The closing balance of the " equivalent number or value of underlying securities" reflects the" total number or value of underlying securities" to which the derivative contracts held by the insider relate. This disclosure does not mean and should not be taken to indicate that the underlying securities have, in fact, been acquired or disposed of by the insider.',
    'Do you want to view transactions with remarks?',
    // "Transaction ID Date of transactionYYYY-MM-DD Date of filingYYYY-MM-DD Ownership type (and registered holder, if applicable) Nature of transaction Number or value acquired or disposed of Unit price or exercise price Closing balance Insider's calculated balance Conversionor exerciseprice Date of expiry or maturityYYYY-MM-DD Underlying security designation Equivalent number or value of underlying securities acquired or disposed of Closing balance of equivalent number or value of underlying securities"
  ];

  const header = [
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
  ];

  // if it has remarks on, add to header and flip flag

  let hasRemarks = false;

  const finalData = [];

  finalData.push(header);

  const anchor = document.createElement('a');

  anchor.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(sediBookmarklet(document))}`);
  anchor.setAttribute('download', constructFilename());

  anchor.click();

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

    const indicatorAName = Array.from(document.querySelectorAll('a')).filter(d => d.hasAttribute('name'))[2];

    const pageTypeEl = document
      .querySelector(`a[name='${indicatorAName.name}'] ~ table ~ table > tbody > tr > td:nth-child(1) font`);

    if (pageTypeEl === null) {
      pageType = 'issuer';
    } else {
      pageType = pageTypeEl
        .textContent
        .replace('name:', '')
        .trim()
        .toLowerCase();
    }

    // if "insider"-mode report, flip header order
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
      if (transactionIdRegex.test(d.textContent.trim())) {
        // construct our headers
        const headerValues = Array.from(d.querySelectorAll('td'))
          .map(d => d.textContent.trim().replace('YYYY-MM-DD', ''))
          .filter(d => d !== '');
        const unitPriceIdx = headerValues.indexOf('Unit price or exercise price');
        headerValues.splice(unitPriceIdx + 1, 0, 'Unit currency, if not CAD');
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

    const secDesTableStartIndices = [];

    const grayTable = grayTableData
      .filter((row, i) => grayTableRemoveIndices.indexOf(i) === -1);

    grayTable.map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:\s/, '');
        switch (true) {
          case securityDesignationRegex.test(str):
            secDesTableStartIndices.push(i);
            break;
        }
      });

    // tables that start with "security designation" bit

    const secDesTables = secDesTableStartIndices
      .map((d, i) => {
        if (i === secDesTableStartIndices.length - 1) {
          return grayTable.slice(d, grayTable.length);
        } else {
          return grayTable.slice(d, secDesTableStartIndices[i + 1]);
        }
      });

    const issuerName = pageType === 'issuer' ? firstOrderName : secondOrderName,
      insiderName = pageType === 'issuer' ? secondOrderName : firstOrderName;

    secDesTables.map(d => {
      extractSecurityDescriptionTable(d, {
        issuerName,
        insiderName,
        insiderRelationship,
        ceasedToBeInsider
      });
    });

  }

  function extractSecurityDescriptionTable(secDesTableData, params) {

    const issuerName = params.issuerName,
      insiderName = params.insiderName,
      insiderRelationship = params.insiderRelationship,
      ceasedToBeInsider = params.ceasedToBeInsider;

    let securityDesignation;

    const secDesTableRemoveIndices = [];

    secDesTableData
      .map((row, i) => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:\s/, '');
        switch (true) {
          case securityDesignationRegex.test(str):
            securityDesignation = strClean;
            secDesTableRemoveIndices.push(i);
            break;
        }
      });

    const generalRemarks = secDesTableData
      .map(row => {
        const str = row.textContent.trim().replace(/\s+/g, ' '),
          strClean = str.replace(/.+:/, '').trim();
        switch (true) {
          case generalRemarksRegex.test(str):
            return strClean;
        }
      })
      .filter(d => d !== undefined);

    secDesTable = secDesTableData
      .filter((row, i) => secDesTableRemoveIndices.indexOf(i) === -1)
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
        rowData[4] = securityDesignation;

        let tdSkip = 0;

        for (var j = 5; j < rowData.length; j++) {
          // td[3], td[15] and td[20] are seemingly always empty, likely spacers,
          // so let's skip them and adjust the count accordingly
          if ([6, 17, 21].indexOf(j) > -1) tdSkip++;
          const tdIndex = j - 3 + tdSkip;
          rowData[j] = td[tdIndex]
          // console.log(`rowData[${i}] equals td[${tdIndex}]`);
        }

        if (hasRemarks) rowData[rowData.length - 1] = generalRemarks[i]; // adds remarks if applicable

        finalData.push(rowData);

      });

    finalData.push(template.slice().fill(' '));

  }

  function extractDateRange() {
    const monthFrom = (parseInt(document.querySelector('input[name="MONTH_FROM_PUBLIC"]').value) + 1).toString(),
      dayFrom = document.querySelector('input[name="DAY_FROM_PUBLIC"]').value,
      yearFrom = document.querySelector('input[name="YEAR_FROM_PUBLIC"]').value,
      monthTo = (parseInt(document.querySelector('input[name="MONTH_TO_PUBLIC"]').value) + 1).toString(),
      dayTo = document.querySelector('input[name="DAY_TO_PUBLIC"]').value,
      yearTo = document.querySelector('input[name="YEAR_TO_PUBLIC"]').value;

    const fromDate = `${yearFrom}${monthFrom.padStart(2, '0')}${dayFrom.padStart(2, '0')}`,
      toDate = `${yearTo}${monthTo.padStart(2, '0')}${dayTo.padStart(2, '0')}`;

    return `${fromDate}-${toDate}`;
  }

  function extractDateRangeType() {
    const dateRangeType = document.querySelector('input[name="DATE_RANGE_TYPE"]');
    return dateRangeType.value == 0 ? 'transactions' : 'filings';
  }

  function constructFilename() {
    const sediName = document.querySelector('body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(15) > tbody > tr > td:nth-child(2)').textContent.trim().replace(/[^a-z0-9]/gi, ''); // need to sanitize

    const sediNumber = document.querySelector('input[name="ATTRIB_DRILL_ID"]').value;

    let filenamePrefix = '';
    if (sediName) filenamePrefix = `${sediName}_`
    if (sediNumber) filenamePrefix = `${filenamePrefix}${sediNumber}_`;

    const dateRangeType = document.querySelector('input[name="DATE_RANGE_TYPE"]');

    let filenameSuffix;

    if (dateRangeType === null) {
      const currDate = new Date(),
        offset = currDate.getTimezoneOffset(),
        offsetDate = new Date(currDate.getTime() - (offset * 60 * 1000)),
        cleanedUpDate = offsetDate.toISOString().replace(/[-T:]/g, '').replace(/\..+/, '');
      filenameSuffix = `as_of_${cleanedUpDate}`;
    } else {
      filenameSuffix = `${extractDateRangeType()}_${extractDateRange()}`;
    }

    return `sedi_${filenamePrefix}${filenameSuffix}.csv`;
  }

})();
