if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express')
const {Client} = require('pg')
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const path = require('path')

const app = express()

const client = new Client({
    user: process.env.USER_DATABASE,
    host: process.env.HOST_DATABASE,
    database: process.env.DATABASE,
    password: process.env.PASSWORD_DATABASE,
    port: process.env.PORT_DATABASE,
})

client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL connection error', err))

const initializePassport = require('./passwort-config')
initializePassport(
    passport,
    async (email) => {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email])
        if (result.rows.length > 0) {
            return result.rows[0]
        }
        return null
    },
    async (id) => {
        const result = await client.query('SELECT * FROM users WHERE user_id = $1', [id])
        if (result.rows.length > 0) {
            return result.rows[0]
        }
        return null
    }
)

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

app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs', { name:req.user.surname })
})

app.get('/login', checkNotAthenticated, (req, res) => {
    res.render('login.ejs')
})

app.post('/login', checkNotAthenticated, (req, res, next) => {
    const email = req.body.email ? req.body.email.trim() : ''
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email || !emailPattern.test(email)) {
        req.flash('error', 'Bitte gib eine gültige E-Mail-Adresse ein.')
        return res.redirect('/login')
    }

    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next)
})

app.get('/register', checkNotAthenticated, (req, res) => {
    res.render('register.ejs')
})

app.post('/register', checkNotAthenticated, async (req, res) => {
    try {
        const hashed_password = await bcrypt.hash(req.body.password, 10)
        await client.query(
            'INSERT INTO users (surname, firstname, email, password) VALUES ($1, $2, $3, $4)',
            [req.body.surname, req.body.firstname, req.body.email, hashed_password]
        )
        return res.redirect('/login')
    } catch (e) {
        console.error(e)
        return res.status(400).redirect('/register')
    }
})

app.delete('/logout', (req, res, next) => {
    req.logOut(err => {
        if (err) {
            return next(err)
        }
        res.redirect('/login')
    })
})

// get Data calls
app.get('/api/slot_data', async (req, res) => {
    try {
        const result = await client.query(
            `SELECT date, id, "from", "to", title, room, repeat, "repeatUntil" 
            FROM time_slots 
            WHERE date >= $1 AND date <= $2 AND user_id = $3 AND repeat = false
            UNION
            SELECT date, id, "from", "to", title, room, repeat, "repeatUntil" 
            FROM time_slots 
            WHERE date <= $2 AND "repeatUntil" >= $1 AND user_id = $3 AND repeat = true`,
            [req.query.startDate, req.query.endDate, req.user.user_id]
        )

        for (let row of result.rows) {
            row.date = row.date.toISOString().slice(0, 10)
            row.from = row.from.toString().slice(0, 5)
            row.to = row.to.toString().slice(0, 5)
        }

        if(result.rows.length > 0) {
            res.setHeader('Content-Type', 'application/json').status(200).send(JSON.stringify(result.rows))
        } else {
            res.sendStatus(204)
        }
    } catch(e) {
        res.status(400).setHeader('Content-Type', 'application/json').send(JSON.stringify({message: 'Error while fetching data'}))
    }
})

app.post('/api/slot_data', async (req, res) => {
    try {
        const query = await client.query(
            'INSERT INTO time_slots (date, user_id, "from", "to", title, room, repeat, "repeatUntil") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [req.body.date, req.user.user_id, req.body.from + ':00', req.body.to + ':00', req.body.title, req.body.room, req.body.repeat, req.body.repeatUntil]
        )

        res.setHeader('Content-Type', 'application/json').status(200).send(JSON.stringify(query.rows[0]))
    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
    
})

app.delete('/api/slot_data', async (req, res) => {
    try {
        await client.query(
            'DELETE FROM time_slots WHERE id = $1',
            [req.body.id]
        )

        res.sendStatus(200)
    } catch (e) {
        console.log(e)
        res.sendStatus(400)
    }
})


function checkAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return res.redirect('/')
    }

    next()
}

app.listen(8080, () => console.log('Server running on Port 8080'))