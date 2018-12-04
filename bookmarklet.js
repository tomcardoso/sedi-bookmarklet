(function() {

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

    const data = Array.from(document.querySelectorAll('table'))
      .filter(d => d.textContent.trim() !== '')
      .filter(d => ignoreRows.indexOf(d.textContent.trim().replace(/\s+/g, ' ')) === -1);

    // construct index of "starting" rows
    const startIndices = [];

    let endIndex;

    const issuerNameRegex = /^Issuer name:.*/,
      insiderNameRegex = /^Insider name:.*/,
      insiderRelationshipRegex = /^Insider's Relationship to Issuer:.*/,
      ceasedToBeInsiderRegex = /^Ceased to be Insider:.*/,
      securityDesignationRegex = /^Security designation:.*/,
      endRegex = /^To download this information.*/;

    data.map((d, i) => {
      if (issuerNameRegex.test(d.textContent.trim())) startIndices.push(i);
      if (endRegex.test(d.textContent.trim())) endIndex = i;
    });

    startIndices.push(endIndex);

    const finalData = [];

    finalData.push(header);

    const tables = startIndices
      .map((d, i) => i !== 0 ? data.slice(startIndices[i - 1], d) : undefined)
      .filter(d => d)
      .map(d => {
        let issuerName,
          insiderName,
          insiderRelationship,
          ceasedToBeInsider,
          securityDesignation;

        const removeIndices = [];

        d.map((row, i) => {
          const str = row.textContent.trim().replace(/\s+/g, ' '),
            strClean = str.replace(/.+:\s/, '');
          switch (true) {
            case issuerNameRegex.test(str):
              issuerName = strClean;
              removeIndices.push(i);
              break;
            case insiderNameRegex.test(str):
              insiderName = strClean;
              removeIndices.push(i);
              break;
            case insiderRelationshipRegex.test(str):
              insiderRelationship = strClean;
              removeIndices.push(i);
              break;
            case ceasedToBeInsiderRegex.test(str):
              ceasedToBeInsider = strClean;
              removeIndices.push(i);
              break;
          }
        });

        const template = Array(header.length).join('.').split('.');

        template[0] = issuerName;
        template[1] = insiderName;
        template[2] = insiderRelationship;
        template[3] = ceasedToBeInsider;

        const tableData = d
          .filter((row, i) => removeIndices.indexOf(i) === -1)
          .map(row => {
            const str = row.textContent.trim().replace(/\s+/g, ' '),
              isSecurityDesignation = securityDesignationRegex.test(str);

            if (isSecurityDesignation) {
              template[4] = str.replace(/.+:\s/, '');
              return;
            }

            const rowData = template.slice();

            const td = Array.from(row.querySelectorAll('tr td'))
              .map(d => d.textContent.trim());

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

            finalData.push(rowData);

          })
          .filter(d => d);

      });

    return jsonToCSV(finalData);

  }

})();
