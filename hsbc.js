/******************************
HSBC Personal Statement to CSV
v0.5

Copyright: Benjie Gillam (2012)
License: WTFPL v2.0 ( http://en.wikipedia.org/wiki/WTFPL )

Instructions:
Add the following bookmarklet to your browser:

javascript:(function(s)%7Bvar%20e%3Ddocument.createElement('script')%3Be.src%3Ds%3Bdocument.head.appendChild(e)%3B%7D)('https%3A%2F%2Fraw.github.com%2Fgist%2F2157849%2FHSBC.js')

Open this bookmarklet when you are looking at a previous statement or recent
transactions in HSBC personal online banking and it will bring up a CSV copy of
your transactions from that statement/list that you can copy to your clipboard
and paste into a file (e.g. to import into Xero or similar services).

Changelog:
v0.5 - Add AJAX fetching of a full year of statements.
v0.4.1 - Add status updates for AJAX fetches.
v0.4 - Add AJAX fetching of extra information for abbreviated transactions
v0.3 - Fix dates for accounts with Overdraft Limits
v0.2 - Adds support for recent transactions, fixes balance=0
v0.1 - initial release

Compatibility: only tested in Chrome 17 under Mac OS X against my own accounts.
Use at your own risk. Educational purposes only. Etc etc.

******************************/
var textarea = null;
var superarray = [];
var additionalPending = 0;
var statementPending = 0;
var errorOccurred = false;
var ascending = true;

var div = document.createElement('div');
var h1 = document.createElement('h1');
h1.innerText = "Double-click to dismiss";
//div.insertBefore(h1,div.firstChild);
div.appendChild(h1);
div.appendChild(document.createTextNode("Date, Transaction Type, Payee, Amount, Balance (GBP)"));
textarea = document.createElement('textarea');
textarea.style.width="100%";
textarea.style.height = "80%";
textarea.value = "If this message remains, then an error has occurred";
div.appendChild(textarea);
div.style.position="fixed";
div.style.top = "100px";
div.style.bottom = "100px";
div.style.border = "10px solid black";
div.style.borderRadius = "25px";
div.style.padding = "20px";
div.style.left = "100px";
div.style.right = "100px";
div.style.zIndex = "100";
div.style.backgroundColor = "white";
div.addEventListener('dblclick',function(e) {
  div.parentNode.removeChild(div);
},false);
document.body.appendChild(div);

function checkFinished() {
  if (errorOccurred) {
    div.style.backgroundColor = "red";
  }
  if (additionalPending+statementPending === 0) {
    done();
  } else {
    textarea.value = additionalPending+" additional info fetches remaining; "+statementPending+" statements fetches remaining...";
  }
};
function done() {
  superarray.reverse();
  var results = [];
  for (var j = 0; j < superarray.length; j++) {
    var array = superarray[j];
    if (!ascending) {
      array.reverse();
    }
    for (var i = 0; i<array.length; i++) {
      results.push(array[i].join(","));
    }
  }
  var csv = results.join("\n");
  textarea.value = csv;
  textarea.focus();
  textarea.select();
}
function parseStatement(statement,$,$rootEl,array) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var in_statement = true;
  //get date from statement header
  var date_tokens = $rootEl.find("div .hsbcTextRight").first()[0].innerText.split(" ");
  if (date_tokens.length > 4) { //in transaction list
    //use 'as at' datetime from transaction header
    date_tokens = $rootEl.find("div .extPibRow .extTableColumn2").eq(2)[0].innerText.split(" ");
    in_statement = false;
  }
  var statementDay = parseInt(date_tokens[0].replace(/^0/,""));
  var statementMonth = months.indexOf(date_tokens[1]);
  var statementYear = parseInt(date_tokens[2]);

  if (statementMonth == 0 && ascending) {
    statementYear--;
  }

  var table = $rootEl.find(".containerMain table").eq(1);
  var stmt_rows = table.find('tbody tr');

  var currentMonth = statementMonth;
  var currentBalance = 0;
  //for every row in the statement
  for (var row_num = 0, num_rows = stmt_rows.length; row_num<num_rows; row_num++) {
    var stmt_row = stmt_rows.eq(row_num);
    if (in_statement && (row_num === 0 || row_num === num_rows-1)) {
      // Skip "Balance brought/carried forward" lines
	    currentBalance = parseFloat(stmt_row.find('td')[5].innerText);
      continue;
    }
    (function(){
      var row = [];
      var cells = stmt_row.find('td');
      var amount = 0;
      for (var cell_num = 0, num_cells = cells.length; cell_num<num_cells; cell_num++) {
        if (cell_num >= 6) {
          continue;
        }
        var cell = cells[cell_num];
        var skip = false;
        var cell_value = cell.innerText;
        if (!in_statement) {
          var tmp = cell_value.split("\n");
          for (var k = 0; k < tmp.length; k++) {
            tmp[k] = $.trim(tmp[k]);
          }
          cell_value = tmp.join("\n");
          cell_value = cell_value.replace(/\n\n/g,"\n");
        }
        //strip various whitespace
        cell_value = cell_value.replace(/[\v\0\r\t]/g," ");
        cell_value = cell_value.replace(/(^ | (?= )| $)/g,"");
        cell_value = cell_value.replace(/"/g,"\\\"");
        cell_value = $.trim(cell_value);
        //concatenate multilines with |
        cell_value = cell_value.replace(/\n/g, " | ");
        
        if (cell_num === 0) {
          //date column
          date_tokens = cell_value.split(" ");
          var day = parseInt(date_tokens[0].replace(/^0/,""));
          var month = months.indexOf(date_tokens[1]);
          if (currentMonth == 11 && month === 0) {
            statementYear++;
          }
          currentMonth = month;
          //format month as %02d
          strMonth = ""+(month+1);
          if (strMonth.length < 2) {
            strMonth = "0"+strMonth;
          }
          //format day as %02d
          strDay = ""+day;
          if (strDay.length < 2) {
            strDay = "0"+strDay;
          }
          //YYYY-MM-DD
          cell_value = ""+statementYear+"-"+strMonth+"-"+strDay;
        }
        if (cell_num < 3) {
          //date, type, description
          cell_value = "\""+cell_value+"\"";
          if (cell_num == 2) {
            //Description
            row[2] = cell_value
            // AJAX fetch more details.
            // var a = cells.eq(cell_num).find("a");
            // if (a && a.length) {
            //   var href = a.attr("href");
            //   console.log("Additional: "+statement+" :: "+a[0].innerText);
            //   additionalPending++;
            //   $.ajax({
            //     url:href
            //   }).done(function(data){
            //     var a = data.indexOf("<strong>Additional details:</strong>");
            //     if (a != -1) {
            //       var relevant = data.substr(a,1000);
            //       relevant = relevant.replace(/^[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*$/,"$1");
            //       relevant = relevant.replace(/<br \/>/g,"");
            //       relevant = $.trim(relevant);
            //       var tmp = relevant.split("\n");
            //       for (var i = 0; i < tmp.length; i++) {
            //         tmp[i] = $.trim(tmp[i]);
            //       }
            //       relevant = tmp.join("\n");
            //       relevant = relevant.replace(/\n\n/g,"\n");
            //       relevant = relevant.replace(/\n/g," | ");
            //       row[2] = "\""+relevant+"\"";
            //       console.log(relevant);
            //     }
            //     additionalPending--;
            //     checkFinished();
            //   });
            // } else {
            //   row[2] = cell_value;
            // }
          }
        } else {
          cell_value = parseFloat(cell_value);
          if (isNaN(cell_value)) {
            cell_value = 0.0;
          }
          if (cell_num == 3) {
            amount -= cell_value;
            skip = true;
          } else if (cell_num == 4) {
            amount += cell_value;
            cell_value = amount;
          } else if (cell_num == 5) {
            if (in_statement) {
              if (cell_value == 0.0) {
                currentBalance = cell_value = parseInt((currentBalance + amount)*100)/100;
              } else {
                currentBalance = cell_value;
              }
            }
          }
        }
        if (!skip) {
          row.push(cell_value);
        }
      }
      array.push(row);
    })();
  }
  checkFinished();
}
(function($){
  var trs = $(".hsbcMainContent table.hsbcRowSeparator tr");
  if (!trs || trs.length < 2) {
    var array = [];
    superarray.push(array);
    parseStatement("Current Page", $, $(document.body), array);
  } else {
    for (var i = 1; i<trs.length; i++) {
      (function(){
        var a = trs.eq(i).find("td a").eq(0);
        var href = a.attr("href");
        var array = [];
        superarray.push(array);
        if (href && href.length) {
          // Fetch it
          statement = a[0].innerText;
          console.log("Statement: "+statement);
          statementPending++;
          $.ajax({
            url:href
          }).done(function(data){
            data = data.replace(/^[\s\S]*<body[^>]*>([\s\S]*)<\/body[\s\S]*$/,"$1");
            var div = document.createElement('div');
            div.innerHTML = data;
            var $div = $(div);
            parseStatement(statement, $, $div, array);
            statementPending--;
            checkFinished();
          });
        } else {
          console.error("One of the links doesn't work!!");
          errorOccurred = true;
        }
      })();
    }
  }
})(jQuery);
checkFinished();