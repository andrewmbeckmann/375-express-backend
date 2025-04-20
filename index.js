const express = require("express");
const sqlite3 = require("sqlite3");
const fs = require('fs');
const cors = require("cors")

const db = new sqlite3.Database("./express.db", (err) => {
    if (err) {
        return console.log(err)
    }
    console.log("connection established")
})


function addValues(){
    const rawData = fs.readFileSync('./swedishdefs.json', 'utf8');
    const jsonData = JSON.parse(rawData);

    db.run(`CREATE TABLE IF NOT EXISTS defs(
        id integer PRIMARY KEY AUTOINCREMENT,
        english text NOT NULL
        swedish text NOT NULL
    )`, (error) => {
        if (error) {
            console.error("Table creation error:", err);
            return;
        }
        

        const preparedSQL = db.prepare("INSERT INTO defs(english, swedish) VALUES (?, ?)");

        for (const [english, swedish] of Object.entries(jsonData)) {
            preparedSQL.run(english, swedish);
        }
    
        preparedSQL.finalize(() => {
            db.all("SELECT * FROM defs", (err, rows) => {
                if (err) {
                    console.error("Select error:", err);
                } else {
                    console.log(rows);
                }
            });
        });
    });
}

function checkValues(){
    db.run(`CREATE TABLE IF NOT EXISTS stuff(
        id integer PRIMARY KEY AUTOINCREMENT,
        swag text NOT NULL
    )`, (error) => {
    
        db.all("SELECT * FROM stuff", (error, rows) => {
            console.log(rows)
        })
    });
}

function addSwag(swagName){
    db.run('INSERT INTO stuff(swag) VALUES (?)', swagName, (err) => {
        console.log(err);
    });
}

checkValues()

var app = express();

app.use(cors());
app.use(express.json())

app.get("/", (req, res)=> {
    res.send("Hello World")
})

app.get("/swag", (req, res) => {
    let sql = 'SELECT * FROM stuff';
    db.all(sql, [], (err, rows) => {
    if (err) {
        res.status(500).json({ error: err.message });
    } else {
        res.json(rows);
    }
    });
});

app.post("/addswag", (req, res) => {
    console.log(req.body.newSwag)
    const newSwag = req.body.newSwag;
    addSwag(newSwag);
    res.send({"message": "Success"});
});

app.listen(4000)
addValues();