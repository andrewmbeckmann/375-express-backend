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
        english text NOT NULL,
        swedish text NOT NULL
    )`, (error) => {
        if (error) {
            console.error("Table creation error:", error);
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

function createSavedWords(){
    db.run(`CREATE TABLE IF NOT EXISTS savedWords(
        id integer PRIMARY KEY AUTOINCREMENT,
        word text UNIQUE NOT NULL
    )`, (error) => {
        console.log(error);
    })
};


function saveWord(word){
    db.run('INSERT INTO savedWords(word) VALUES (?)', word, (err) => {
        console.log(err);
    });
}

createSavedWords()

var app = express();

app.use(cors());
app.use(express.json())

app.get("/", (req, res)=> {
    res.send("Hello World")
})

app.get("/translate", (req, res) => {
    let english = req.body.english;
    const sql = 'SELECT swedish FROM defs WHERE english = ?';
    db.get(sql, [english], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ message: "Translation not found" });
        } else {
            res.json({ swedish: row.swedish });
        }
    });
});

app.get("/getsaved", (req, res) => {
    let sql = 'SELECT * FROM savedWords';
    db.all(sql, [], (err, rows) => {
    if (err) {
        res.status(500).json({ error: err.message });
    } else {
        res.json(rows);
    }
    });
});

app.post("/saveword", (req, res) => {
    console.log(req.body.word)
    const word = req.body.word;
    saveWord(word);
    res.send({"message": "Success"});
});

app.listen(4000)
addValues();