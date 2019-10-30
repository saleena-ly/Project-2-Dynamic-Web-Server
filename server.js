// Built-in Node.js modules
var fs = require('fs')
var path = require('path')

// NPM modules
var express = require('express')
var sqlite3 = require('sqlite3')


var public_dir = path.join(__dirname, 'public');
var template_dir = path.join(__dirname, 'templates');
var db_filename = path.join(__dirname, 'db', 'usenergy.sqlite3');

var app = express();
var port = 8000;

// open usenergy.sqlite3 database
var db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir));


// GET request handler for '/'
app.get('/', (req, res) => {
    db.all('SELECT * FROM Consumption WHERE year = ?', [2017], (err, rows) => {
        if (err) console.error('there was an issue querying the database.');
        else {
            let count = {
                coal: 0,
                natural_gas: 0,
                nuclear: 0,
                petroleum: 0,
                renewable: 0
            }

            let tableData = '';

            rows.forEach(row => {
                tableData += `<tr><td>${row.state_abbreviation}</td>`;

                /*loops through coal, natural_gas, nuclear... and increments the
                respective count and creates a cell in the table.*/
                for (key in count) {
                    count[key] += row[key];
                    tableData += `<td>${row[key]}</td>`;
                }
                tableData += '</tr>';
            });

            ReadFile(path.join(template_dir, 'index.html')).then((template) => {
                let response = template;

                //loops through all of the counts and replaces the html file contents
                for (key in count) {
                    response = response.replace(`var ${key}_count;`, `var ${key}_count = ${count[key]}`);
                }

                response = response.replace('<!-- Data to be inserted here -->', tableData);

                WriteHtml(res, response);
            }).catch((err) => {
                Write404Error(res);
            });
        }
    });
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    let currentYear = parseInt(req.params.selected_year);

    db.all('SELECT * FROM Consumption WHERE year = ?', [currentYear], (err, rows) => {
        if (err) {
            console.log('there was an issue querying the db');
        }
        //the database returned an empty array for rows
        else if (rows.length == 0) {
            console.log(`the database didn't respond with data for ${currentYear}`);
            WriteCustom404Error(res, `no data for the year ${currentYear}`);
        }
        else {
            let count = {
                coal: 0,
                natural_gas: 0,
                nuclear: 0,
                petroleum: 0,
                renewable: 0
            }

            let tableData = '';

            //go through each row and total up each catagory and store it in count
            rows.forEach(row => {
                tableData += `<tr><td>${row.state_abbreviation}</td>`;

                let stateTotal = 0;

                for (key in count) {
                    count[key] += row[key];
                    tableData += `<td>${row[key]}</td>`;
                    stateTotal += count[key];
                }

                tableData += `<td>${stateTotal}</td>`;

                tableData += '</tr>';
            });

            ReadFile(path.join(template_dir, 'year.html')).then(template => {
                let response = template;

                //replace the title
                response = response.replace('<title>US Energy Consumption</title>', `<title>${currentYear} US Energy Consumption</title>`);

                //replace h2
                response = response.replace('<h2>National Snapshot</h2>', `<h2>${currentYear} National Snapshot</h2>`);

                //replace the year
                response = response.replace('var year;', `var year = ${currentYear};`);

                //replace all of the variables with their new value
                for (key in count) {
                    response = response.replace(`var ${key}_count;`, `var ${key}_count = ${count[key]};`);
                }

                //get the next/prev year using tertiary opertator to check for bounds
                let nextYear = currentYear == 2017 ? 2017 : currentYear + 1;
                let prevYear = currentYear == 1960 ? 1960 : currentYear - 1;

                //update the next/prev buttons to navigate between years
                response = response.replace('<a class="prev_next" href="">Prev</a>', `<a class="prev_next" href="/year/${prevYear}">${prevYear}</a>`);
                response = response.replace('<a class="prev_next" href="">Next</a>', `<a class="prev_next" href="/year/${nextYear}">${nextYear}</a>`);

                //insert the tableData into the table
                response = response.replace('<!-- Data to be inserted here -->', tableData);

                WriteHtml(res, response);
            }).catch((err) => {
                Write404Error(res);
            });
        }
    });
});

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    let currentState = req.params.selected_state;

    //get all of the consumption data from the database
    db.all('SELECT * FROM Consumption WHERE state_abbreviation = ?', [currentState], (err, rows) => {
        //get the state information - an array containing an object for each state
        db.all('SELECT * FROM States', (err, states) => {
            //object with a key for each energy type -- the value being an array of each year's total
            let counts = {
                coal: [],
                natural_gas: [],
                nuclear: [],
                petroleum: [],
                renewable: []
            }

            let tableData = '';

            //loop through the database rows and push the yearly totals to it's respective array in counts
            rows.forEach(row => {
                let row_total = 0;

                //each row in the table starts out with the year
                tableData += `<tr><td>${row.year}</td>`;

                for (key in counts) {
                    counts[key].push(row[key]);
                    tableData += `<td>${row[key]}</td>`;
                    row_total += row[key]
                }

                //once the row has first 6 columns, insert the last column -- the total
                tableData += `<td>${row_total}</td></tr>`;
            });

            ReadFile(path.join(template_dir, 'state.html')).then(template => {
                let response = template;

                //replace the state variable
                response = response.replace(`var state;`, `var state = '${currentState}';`);

                //replace the title
                response = response.replace(`<title>US Energy Consumption</title>`, `<title>${currentState} US Energy Consumption</title>`);

                //replace the h2
                response = response.replace(`<h2>In Depth Analysis</h2>`, `<h2>${currentState} In Depth Analysis</h2>`);

                //loop through the counts variable and update the energy type variables
                for (key in counts) {
                    response = response.replace(`var ${key}_counts;`, `var ${key}_counts = [${counts[key]}];`);
                }

                //insert the table data into the template
                response = response.replace('<!-- Data to be inserted here -->', tableData);

                let stateIndex = states.findIndex(state => state.state_abbreviation === currentState);
                let nextState = stateIndex == 50 ? states[0].state_abbreviation : states[stateIndex + 1].state_abbreviation;
                let prevState = stateIndex == 0 ? states[50].state_abbreviation : states[stateIndex - 1].state_abbreviation;

                response = response.replace('<a class="prev_next" href="">XX</a> <!-- change XX to prev state, link to WY if state is AK -->',
                    `<a class="prev_next" href="/state/${prevState}">${prevState}</a>`);
                response = response.replace('<a class="prev_next" href="">XX</a> <!-- change XX to next state, link to AK if state is WY -->',
                    `<a class="prev_next" href="/state/${nextState}">${nextState}</a>`);

                WriteHtml(res, response);
            }).catch((err) => {
                Write404Error(res);
            });
        });
    });
});

// GET request handler for '/energy-type/*'
app.get('/energy-type/:selected_energy_type', (req, res) => {
    ReadFile(path.join(template_dir, 'energy.html')).then((template) => {
        let response = template;



        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

function ReadFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.toString());
            }
        });
    });
}

function Write404Error(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.write('Error: file not found');
    res.end();
}

function WriteHtml(res, html) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(html);
    res.end();
}

let WriteCustom404Error = (res, reason) => {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    //read the 404 template and insert the custom reason
    ReadFile(path.join(template_dir, '404.html'))
        .then(template => {
            template = template.replace('<p class ="error-reason">page not found</p>',
                `<p class ="error-reason">${reason}</p>`);

            res.write(template);
            res.end();
        })
        .catch(err => { console.log(err); });
}

var server = app.listen(port);
