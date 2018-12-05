(function() {

  let pageType, hasRemarks;

  const issuerNameRegex = /^Issuer name:.*/,
    insiderNameRegex = /^Insider name:.*/,
    insiderRelationshipRegex = /^Insider's Relationship to Issuer:.*/,
    ceasedToBeInsiderRegex = /^Ceased to be Insider:.*/,
    securityDesignationRegex = /^Security designation:.*/,
    endRegex = /^To download this information.*/,
    generalRemarksRegex = /^General remarks:.*/;

  const ignoreRows = [
    "Legend: O - Original transaction, A - First amendment to transaction, A' - Second amendment to transaction, AP - Amendment to paper filing, etc.",
    "Insider's Relationship to Issuer: 1 - Issuer, 2 - Subsidiary of Issuer, 3 - 10% Security Holder of Issuer, 4 - Director of Issuer, 5 - Senior Officer of Issuer, 6 - Director or Senior Officer of 10% Security Holder, 7 - Director or Senior Officer of Insider or Subsidiary of Issuer (other than in 4,5,6), 8 - Deemed Insider - 6 Months before becoming Insider.",
    'Warning: The closing balance of the " equivalent number or value of underlying securities" reflects the" total number or value of underlying securities" to which the derivative contracts held by the insider relate. This disclosure does not mean and should not be taken to indicate that the underlying securities have, in fact, been acquired or disposed of by the insider.',
    'Do you want to view transactions with remarks?',
    "Transaction ID Date of transactionYYYY-MM-DD Date of filingYYYY-MM-DD Ownership type (and registered holder, if applicable) Nature of transaction Number or value acquired or disposed of Unit price or exercise price Closing balance Insider's calculated balance Conversionor exerciseprice Date of expiry or maturityYYYY-MM-DD Underlying security designation Equivalent number or value of underlying securities acquired or disposed of Closing balance of equivalent number or value of underlying securities"
  ];

  const header = [
    'Issuer name',
    'Insider name',
    'Insider\'s Relationship to Issuer',
    'Ceased to be Insider',
    'Security designation',
    'Transaction type',
    'Transaction ID',
    'Date of transaction',
    'Date of filing',
    'Ownership type',
    'Nature of transaction',
    'Number or value acquired or disposed of',
    'Unit price or exercise price',
    'Closing balance',
    'Insider\'s calculated balance',
    'Conversion or exercise price',
    'Date of expiry or maturity',
    'Underlying security designation',
    'Equivalent number or value of underlying securities acquired or disposed of',
    'Closing balance of equivalent number or value of underlying securities',
  ];

  // if it has remarks on, add to header and flip flag
  const remarksTest = document
    .querySelector('body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(22) > tbody > tr > td:nth-child(1) > i > font')
    .textContent
    .trim()
    .indexOf('without');

  hasRemarks = remarksTest > -1;

  if (hasRemarks) header.push('General remarks');

  const finalData = [];

  finalData.push(header);

  const template = Array(header.length).join('.').split('.');

  const anchor = document.createElement('a');

  anchor.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(sediBookmarklet(document))}`);
  anchor.setAttribute('download', 'sedi.csv');
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

    pageType = document
      .querySelector('body > table:nth-child(2) > tbody > tr:nth-child(3) > td > table > tbody > tr > td > table:nth-child(15) > tbody > tr > td:nth-child(1) > b > font')
      .textContent
      .replace('name:', '')
      .trim()
      .toLowerCase();

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

    data.map((d, i) => {
      if (firstOrderNameRegex.test(d.textContent.trim())) startIndices.push(i);
      if (endRegex.test(d.textContent.trim())) endIndex = i;
    });

    startIndices.push(endIndex);

    // tables that start with either "Issuer name" or "Insider name"

    const parentTables = startIndices
      .map((d, i) => i !== 0 ? data.slice(startIndices[i - 1], d) : undefined)
      .filter(d => d)
      .map(d => {
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

    let grayTables;

    if (grayTableStartIndices.length === 1) {
      grayTables = [parentTable.slice()];
    } else {
      grayTables = grayTableStartIndices
        .map((d, i) => {
          if (i === grayTableStartIndices.length - 1) {
            return parentTable.slice(d, parentTable.length);
          } else {
            return parentTable.slice(d, grayTableStartIndices[i + 1]);
          }
        });

    }

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

    let secDesTables;

    if (secDesTableStartIndices.length === 1) {
      secDesTables = [grayTable.slice()];
    } else {
      secDesTables = secDesTableStartIndices
        .map((d, i) => {
          if (i === secDesTableStartIndices.length - 1) {
            return grayTable.slice(d, grayTable.length);
          } else {
            return grayTable.slice(d, secDesTableStartIndices[i + 1]);
          }
        });
    }

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

        rowData[5] = td[2]; // 'Transaction type'
        rowData[6] = td[4]; // 'Transaction ID'
        rowData[7] = td[5]; // 'Date of transaction'
        rowData[8] = td[6]; // 'Date of filing'
        rowData[9] = td[7]; // 'Ownership type'
        rowData[10] = td[8]; // 'Nature of transaction'
        rowData[11] = td[9]; // 'Number or value acquired or disposed of'
        rowData[12] = td[10]; // 'Unit price or exercise price'
        rowData[13] = td[12]; // 'Closing balance'
        rowData[14] = td[13]; // 'Insider's calculated balance'
        rowData[15] = td[14]; // 'Conversion or exercise price'
        rowData[16] = td[16]; // 'Date of expiry or maturity'
        rowData[17] = td[17]; // 'Underlying security designation'
        rowData[18] = td[18]; // 'Equivalent number or value of underlying securities acquired or disposed of'
        rowData[19] = td[19]; // 'Closing balance of equivalent number or value of underlying securities'

        if (hasRemarks) rowData[20] = generalRemarks[i]; // adds remarks if applicable

        finalData.push(rowData);

      });

    finalData.push(template.slice().fill(' '));

  }

})();
