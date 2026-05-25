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
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs', { name:req.user.surname })
})

app.get('/login', checkNotAthenticated, (req, res) => {
    res.render('login.ejs')
})

app.post('/login', checkNotAthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

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