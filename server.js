// checks if we are in production, if not load the .env file
if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

// import necessary modules
const express = require('express')
const {Pool} = require('pg')
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const path = require('path')

// create express app -> base for server
const app = express()

// create a new PostgreSQL pool using environment variables for configuration
const pool = new Pool({
    user: process.env.USER_DATABASE,
    host: process.env.HOST_DATABASE,
    database: process.env.DATABASE,
    password: process.env.PASSWORD_DATABASE,
    port: process.env.PORT_DATABASE,
})

// start connection to PostgreSQL server
pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL connection error', err))

// get passport init function from seperate .js file
const initializePassport = require('./passwort-config')

// initialize passport include functions for retrieving user by email and id from database
initializePassport(
    passport,
    async (email) => {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
        if (result.rows.length > 0) {
            return result.rows[0]
        }
        return null
    },
    async (id) => {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id])
        if (result.rows.length > 0) {
            return result.rows[0]
        }
        return null
    }
)

// set up middleware for the express app
app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))

// load index page if authenticated, otherwise redirect to login page
app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs', { name:req.user.surname })
})

// load login page if not authenticated, otherwise redirect to index page
app.get('/login', checkNotAthenticated, (req, res) => {
    res.render('login.ejs')
})

// handle login form submission, authenticate user using passport and redirect accordingly
app.post('/login', checkNotAthenticated, passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })
)

// load registration page if not authenticated, otherwise redirect to index page
app.get('/register', checkNotAthenticated, (req, res) => {
    res.render('register.ejs')
})

// handle registration form submission, hash password and store new user in database, then redirect to login page
app.post('/register', checkNotAthenticated, async (req, res) => {
    try {
        // hash the password using bcrypt with a salt rounds of 10
        const hashed_password = await bcrypt.hash(req.body.password, 10)

        // insert new user into the database with the provided surname, firstname, email and hashed password
        await pool.query(
            `INSERT INTO users (surname, firstname, email, password) 
             VALUES ($1, $2, $3, $4)`,
            [req.body.surname, req.body.firstname, req.body.email, hashed_password]
        )

        // if successful, redirect to login page
        return res.redirect('/login')
    } catch (e) {
        // if there is an error (e.g. email already exists), log the error and show an appropriate message on the registration page
        console.error(e)
        const message = e.code === '23505' ? 'Diese E-Mail-Adresse ist bereits registriert.' : 'Fehler bei der Registrierung. Bitte versuche es erneut.'
        return res.status(400).render('register.ejs', { messages: { error: message } })
    }
})

// handle logout request, log out the user and redirect to login page
app.delete('/logout', checkAuthenticated, (req, res, next) => {
    // use passport's logOut function to log out the user, then redirect to login page
    req.logOut(err => {
        if (err) {
            return next(err)
        }
        res.redirect('/login')
    })
})

// API endpoint to fetch time slot data for the authenticated user within a specified date range, including both direct and repeating slots
app.get('/api/slot_data', checkAuthenticated, async (req, res) => {
    try {
        // load data
        const result = await pool.query(
            `SELECT date, id, "from", "to", title, room, repeat, "repeatUntil" 
             FROM time_slots 
             WHERE date >= $1 AND date <= $2 AND user_id = $3 AND repeat = false
             UNION
             SELECT date, id, "from", "to", title, room, repeat, "repeatUntil" 
             FROM time_slots 
             WHERE date <= $2 AND "repeatUntil" >= $1 AND user_id = $3 AND repeat = true`,
            [req.query.startDate, req.query.endDate, req.user.user_id]
        )
        
        // format date and time for frontend
        for (let row of result.rows) {
            row.date = row.date.toISOString().slice(0, 10)
            row.from = row.from.toString().slice(0, 5)
            row.to = row.to.toString().slice(0, 5)
        }
        
        // if there are results, send them as JSON, otherwise send a 204 No Content status
        if(result.rows.length > 0) {
            res.setHeader('Content-Type', 'application/json').status(200).send(JSON.stringify(result.rows))
        } else {
            res.sendStatus(204)
        }
    } catch(e) {
        // if there is an error while fetching data, log the error and send a 400 Bad Request status with an appropriate message
        console.error(e)
        res.status(400).setHeader('Content-Type', 'application/json').send(JSON.stringify({message: 'Error while fetching data'}))
    }
})

// API endpoint to create a new time slot for the authenticated user, with data provided in the request body
app.post('/api/slot_data', checkAuthenticated, async (req, res) => {
    try {
        // insert data into the database, returning the id of the newly created time slot
        const query = await pool.query(
            `INSERT INTO time_slots (date, user_id, "from", "to", title, room, repeat, "repeatUntil") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING id`,
            [req.body.date, req.user.user_id, req.body.from + ':00', req.body.to + ':00', req.body.title, req.body.room, req.body.repeat, req.body.repeatUntil]
        )

        // send id of the newly created time slot as JSON response with a 200 OK status
        res.setHeader('Content-Type', 'application/json').status(200).send(JSON.stringify(query.rows[0]))
    } catch (e) {
        // if there is an error while creating the time slot, log the error and send a 400 Bad Request status with an appropriate message
        console.error(e)
        res.status(400).setHeader('Content-Type', 'application/json').send(JSON.stringify({message: 'Error while creating time slot'}))
    }
    
})

// API endpoint to delete a time slot for the authenticated user, with the id of the time slot provided in the request body
app.delete('/api/slot_data', checkAuthenticated, async (req, res) => {
    try {
        // delete time slot -> id is used to verify that the time slot belongs to the authenticated user, 
        // preventing unauthorized deletion of other users' time slots
        await pool.query(
            `DELETE FROM time_slots 
             WHERE id = $1 AND user_id = $2`,
            [req.body.id, req.user.user_id]
        )

        res.sendStatus(200)
    } catch (e) {
        // if there is an error while deleting the time slot, log the error and send a 400 Bad Request status with an appropriate message
        console.error(e)
        res.status(400).setHeader('Content-Type', 'application/json').send(JSON.stringify({message: 'Error while deleting time slot'}))
    }
})

// API endpoint to fetch the next upcoming time slot for the authenticated user, with the current date and time provided as query parameters
app.get('/api/slot_data/get_next_timeslot', async (req, res) => {
    try {
        // query to get the next upcoming time slot for the authenticated user, ordered by date and time
        const result = await pool.query(
            `WITH event_occurrences AS (
                SELECT
                    e.*,
                    CASE
                        -- One-time event
                        WHEN e.repeat = false THEN
                            CASE
                                WHEN e.date >= $2
                                THEN e.date
                            END

                        -- Weekly recurring event
                        WHEN e.repeat = true THEN
                            CASE
                                WHEN e.date >= $2 THEN
                                    e.date
                                ELSE
                                    e.date +
                                    (
                                        CEIL(
                                            ($2 - e.date)::numeric / 7
                                        )::int * 7
                                    )
                            END
                    END AS next_occurrence
                FROM time_slots e
                WHERE e.user_id = $1
            )
            SELECT next_occurrence, "from", "to", room
            FROM event_occurrences
            WHERE
                next_occurrence IS NOT NULL
                AND (
                    "repeatUntil" IS NULL
                    OR next_occurrence <= "repeatUntil"
                ) 
                AND (
                    next_occurrence != $2
                    OR "to" > $3
                )
            ORDER BY next_occurrence, "from"
            LIMIT 1`,
            [req.query.id, req.query.currentDate, req.query.currentTime]
        )
        
        // if there is a result, send it as JSON response with a 200 OK status, otherwise send a 204 No Content status
        if(result.rows.length > 0) {
            res.setHeader('Content-Type', 'application/json').status(200).send(JSON.stringify(result.rows[0]))
        } else {
            res.sendStatus(204)
        }
    } catch (e) {
        // if there is an error while fetching the next time slot, log the error and send a 400 Bad Request status with an appropriate message
        console.error(e)
        res.status(400).setHeader('Content-Type', 'application/json').send(JSON.stringify({message: 'Error while fetching next time slot'}))
    }
})

// middleware function to check if the user is authenticated, allowing access to the next middleware or route handler if authenticated, otherwise redirecting to the login page
function checkAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

// middleware function to check if the user is not authenticated, allowing access to the next middleware or route handler if not authenticated, otherwise redirecting to the index page
function checkNotAthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return res.redirect('/')
    }

    next()
}

// start the server on port 8080 and log a message to the console, also set up handlers for graceful shutdown on receiving termination signals
const server = app.listen(8080, () => console.log('Server running on Port 8080'))

// flag to track if shutdown is already in progress
let isShuttingDown = false

// handle graceful shutdown on SIGTERM, SIGINT and SIGUSR2 signals by closing the server and database connection before exiting the process
async function shutdown(sigName) {
    // prevent multiple shutdown attempts
    if (isShuttingDown) {
        return
    }
    isShuttingDown = true
    
    console.log(`Shutting down server on ${sigName}...`);
    server.close(async () => {
        console.log('Closed out remaining connections');
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('SIGUSR2', shutdown)