import express from "express";
import bodyParser from "body-parser";
// import path from "path";
// import { fileURLToPath} from "url";
import { sql } from '@vercel/postgres';
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const saltRounds = 10;
env.config();

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 60 *24,
        },
    })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });
  pool.connect();

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs")
})

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

app.get("/todolist", async (req, res) => {
    try{
    if (req.isAuthenticated()) {
        const userId = req.user.id;
        const result = (await sql.query("SELECT * FROM tasks WHERE user_id = $1 ORDER BY id ASC", [
                userId
                ]));
        const taskList = result.rows;
        res.render("todolist.ejs", {taskList: taskList})    
    } else {
        res.redirect("/login")
    }}catch(err){
        console.log(err)
    }
});


app.post("/login", passport.authenticate("local", {
    successRedirect: "/todolist",
    failureRedirect: "/login",
})
);

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;

    try {
        const checkResult = await sql.query("SELECT * FROM users WHERE email = $1", [
            email,
        ]);
        if (checkResult.rows.length > 0) {
            res.redirect("/login");
        } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error("Error hashing password:", err);
                } else {
                    const result = await sql.query(
                        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
                        [email, hash]
                    );
                    const user = result.rows[0];
                    req.login(user, (err) => {
                        console.log("success");
                        res.redirect("/todolist");
                    });
                }
            });
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/add", async (req, res) => {
    const task = req.body.add;
    const userId = req.user.id;
    let taskStatus = req.body.id;

    try {
        await sql.query(
            "INSERT INTO tasks (content, user_id) VALUES ($1, $2) RETURNING *", [
            task, userId,
        ])
        res.redirect("/todolist");
    } catch (err) {
        console.log(err);
    }
});

app.post("/checked", async (req, res) => {
    try {
    const checkedTask = req.body.checkedTask;
    const taskStatus = await sql.query(
        "SELECT done FROM tasks WHERE id = $1", [checkedTask]
    );
        if (taskStatus.rows[0].done === false) {
            await sql.query(
                "UPDATE tasks SET done = true WHERE id = $1", [checkedTask]
                )
                res.redirect("/todolist");
        } else if (taskStatus.rows[0].done === true){
            await sql.query(
                "UPDATE tasks SET done = false WHERE id = $1", [checkedTask]
                )
                res.redirect("/todolist");
        }
    }catch (err) {
        console.log(err);
    }
});

app.post("/edit", async (req, res) => {
    const taskId = req.body.updatedTaskId;
    const taskContent = req.body.updatedTaskContent;
    await sql.query("UPDATE tasks SET content = $1 WHERE id = $2", [taskContent, taskId]);
    res.redirect("/todolist");
})

app.post("/delete", async (req, res) => {
    const taskId = req.body.deletedTask;
    try{
        await sql.query("DELETE FROM tasks WHERE id = $1;", [taskId]);
        res.redirect("/todolist");
      } catch(err){
        console.log(err);
      }
})

passport.use(new Strategy (async function verify(username, password, cb){
    try {
        const result = await sql.query("SELECT * FROM users WHERE email = $1", [
            username,
        ]);
        if (result.rows.length > 0){
            const user = result.rows[0];
            const storedHashedPassword = user.password;
            bcrypt.compare(password, storedHashedPassword, (err, result) => {
                if (err) {
                    return cb(err);
                } else {
                    if (result) {
                        return cb(null, user);
                    }else {
                        return cb(null, false);
                    }
                }
            });
        } else {
            return cb("User not found");
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(process.env.PORT, () => {
    console.log("Listening on port "+ process.env.PORT);
});