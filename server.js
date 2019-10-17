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

            let tableBody = '';

            rows.forEach(row => {
                tableBody += `<tr><td>${row.state_abbreviation}</td>`;

                /*loops through coal, natural_gas, nuclear... and increments the
                respective count and creates a cell in the table.*/
                for(key in count) { 
                    count[key] += row[key];
                    tableBody += `<td>${row[key]}</td>`;
                }
                tableBody += '</tr>';
            });

            ReadFile(path.join(template_dir, 'year.html')).then((template) => {
                let response = template;
                
                //loops through all of the counts and replaces the html file contents
                for(key in count) { 
                    response = response.replace(`var ${key}_count;`, `var ${key}_count = ${count[key]}`);
                }

                response = response.replace('<!-- Data to be inserted here -->', tableBody);

                WriteHtml(res, response);
            }).catch((err) => {
                Write404Error(res);
            });
        }
    });
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    ReadFile(path.join(template_dir, 'year.html')).then((template) => {
        let response = template;
        // modify `response` here
        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    ReadFile(path.join(template_dir, 'state.html')).then((template) => {
        let response = template;
        // modify `response` here
        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

// GET request handler for '/energy-type/*'
app.get('/energy-type/:selected_energy_type', (req, res) => {
    ReadFile(path.join(template_dir, 'energy.html')).then((template) => {
        let response = template;
        // modify `response` here
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
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('Error: file not found');
    res.end();
}

function WriteHtml(res, html) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(html);
    res.end();
}


var server = app.listen(port);
