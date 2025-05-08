require("dotenv").config()

const express = require("express");
const sqlite3 = require("sqlite3");
const fs = require('fs');
const cors = require("cors")
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = new sqlite3.Database("./express.db", (err) => {
    if (err) {
        return console.log(err)
    }
    console.log("connection established")
})


function addValues(){
    const swedishData = JSON.parse(fs.readFileSync('./en.json', 'utf8'));
    const spanishData = JSON.parse(fs.readFileSync('./es.json', 'utf8'));

    const englishKeys = Object.keys(swedishData);
    const swedishValues = Object.values(swedishData);
    const spanishKeys = Object.keys(spanishData);

    db.run(`CREATE TABLE IF NOT EXISTS defs(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        swedish TEXT NOT NULL,
        spanish TEXT NOT NULL
    )`, (error) => {
        if (error) {
            console.error("Table creation error:", error);
            return;
        }

        const preparedSQL = db.prepare("INSERT INTO defs(english, swedish, spanish) VALUES (?, ?, ?)");

        for (let i = 0; i < englishKeys.length; i++) {
            const spanish = spanishKeys[i] || "";
            preparedSQL.run(englishKeys[i], swedishValues[i], spanish);
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

function createSavedUserWords(){
    db.run(`CREATE TABLE IF NOT EXISTS savedUserWords(
        id integer PRIMARY KEY AUTOINCREMENT,
        word text NOT NULL,
        user text NOT NULL,
        spanish text NOT NULL,
        english text NOT NULL,
        UNIQUE(word, user)
    )`, (error) => {
        console.log(error);
    })
};

function createUsers(){
    db.run(`CREATE TABLE IF NOT EXISTS userData(
        id integer PRIMARY KEY AUTOINCREMENT,
        user text UNIQUE NOT NULL,
        hash text NOT NULL
    )`, (error) => {
        console.log(error);
    })
};

function logUsers(){
    db.all("SELECT * FROM userData", (err, rows) => {
        if (err) {
            console.error("Select error:", err);
        } else {
            console.log(rows);
        }
    });
}

function saveWord(word){
    db.run('INSERT INTO savedWords(word) VALUES (?)', word, (err) => {
        console.log(err);
    });
}

function saveUserWord(word, user){
    db.get('SELECT spanish, english FROM defs WHERE swedish = ?', [word], (err, row) => {
        if (err) {
            console.error('Error retrieving translations:', err);
            return;
        }

        if (!row) {
            console.error('No translation found for:', word);
            return;
        }

        const { spanish, english } = row;

        db.run(
            'INSERT INTO savedUserWords(word, user, spanish, english) VALUES (?, ?, ?, ?)',
            [word, user, spanish, english],
            (err) => {
                if (err) {
                    console.error('Error saving user word:', err);
                } else {
                    console.log('Saved user word successfully.');
                }
            }
        );
    });
}

createSavedWords();
createSavedUserWords();
createUsers();

var app = express();

app.use(cors());
app.use(express.json())

app.get("/", (req, res)=> {
    res.send("Hello World")
})

app.post("/translate", (req, res) => {
    let input = req.body.input;
    let languageName = req.body.languageName;

    if(input === "my name jeff") return res.json({ swedish: "you will die in five minutes"})

    const allowedColumns = ['english', 'spanish']; // whitelist of valid column names
    if (!allowedColumns.includes(languageName)) {
        return res.status(400).json({ error: "Invalid language name" }); //only triggered maliciously
    }

    const sql = `SELECT swedish FROM defs WHERE ${languageName} = ?`;
    db.get(sql, [input], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ message: "Translation not found" });
        } else {
            res.json({ swedish: row.swedish });
        }
    });
});

app.post("/signup", async (req, res) => {
    let user = req.body.user;
    let password = req.body.password;
    let hash = await bcrypt.hash(password, 10);

    db.run('INSERT INTO userData(user, hash) VALUES (?, ?)', [user, hash], (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "Failed to signup" });
        }

        res.json({ message: "Signup successful" });
    });
    logUsers();
});

app.post("/attemptlogin", async (req, res) => {
    let user = req.body.user;
    let password = req.body.password;
    const sql = 'SELECT hash FROM userData WHERE user = ?';
    db.get(sql, user, async (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ message: "User not found" });
        } else if (await bcrypt.compare(password, row.hash)) {
            const accessToken = jwt.sign({user}, process.env.ACCESS_TOKEN_SECRET)
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ message: "Invalid password" });
        }
    });
});

app.post("/getusersaved", authenticateToken, (req, res) => {
    let user = req.user.user;
    let sql = 'SELECT * FROM savedUserWords WHERE user = ?';
    db.all(sql, user, (err, rows) => {
    if (err) {
        res.status(500).json({ error: err.message });
    } else {
        res.json(rows);
    }
    });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next();
    })
}

app.post("/saveuserword", authenticateToken, (req, res) => {
    const word = req.body.word;
    let user = req.user.user;
    saveUserWord(word, user);
    res.send({"message": "Success"});
});

app.listen(4000)
addValues();