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

function createSavedUserWords(){
    db.run(`CREATE TABLE IF NOT EXISTS savedUserWords(
        id integer PRIMARY KEY AUTOINCREMENT,
        word text NOT NULL,
        user text NOT NULL
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
    db.run('INSERT INTO savedUserWords(word, user) VALUES (?)', [word, user], (err) => {
        console.log(err);
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

app.post("/saveword", (req, res) => {
    console.log(req.body.word)
    const word = req.body.word;
    saveWord(word);
    res.send({"message": "Success"});
});

app.listen(4000)
addValues();