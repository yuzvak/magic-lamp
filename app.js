const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const dir = __dirname+'/views/';
const bodyParser = require('body-parser');
const db = require('./db.json') // template database
const fs = require('fs');
const bot = require('./bot.js')

const passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy;

// auth
let sessions = {};

// codes for tg
let tg_code = {"temlat": 'TemplateLamp'};

app.use(require('cookie-parser')());
app.use(require('express-session')({ secret: 'FwfewSgergergq', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new LocalStrategy(
  function(username, password, done) {
      for(let i in db) {
          if(db[i]['user']['username'] === username) {
              if(db[i]['user']['password'] === password) {
                  let idLamp = db[i]['lamp'].id;
                  session = randomSession();
                  sessions[session] = {lamp_id: idLamp, username: username};
                  return done(null, session);
              }
          }
      }
      return done(null, false, { message: 'Incorrect password.' });
  }
));
// end auth

app.use('/static', require('express').static(__dirname+'/static'))
app.use(bodyParser.urlencoded({extended: true}));
// main page

app.get('/', (req, res) => {
    if(checkAuth(req) === false) {
        res.render(dir+'index.ejs', {user: null})
        res.end();
        return 0;
    }
    res.render(dir+'index.ejs', {user: sessions[req.user]})
    res.end();
    return 0;
});

app.get('/manage', (req,res) => {
    if(checkAuth(req) === false) {
        res.redirect('/login');
        res.end();
        return;
    }
    res.render(dir+'manage.ejs', {lamp: db[sessions[req.user].lamp_id]['lamp'], session: req.user});
    res.end();
    return 0;
});

//login page
app.get('/login', (req, res) => {
    if(checkAuth(req) === true) {
        res.redirect('/');
        res.end();
        return;
    }
    if(req.query.error) {
        res.render(dir+'login.ejs', {error: req.query.error });
        res.end();
        return;
    }
    res.render(dir+'login.ejs', {error: null});
    res.end();
    return 0;
});

app.post('/login', (req, res, next) => {
    let user = req.body.username;
    passport.authenticate('local', (err, user, info) => {
        if(err) {
            console.log(err.message)
            res.redirect('/login');
            res.end();
            return;
        }
        if(!user) {
            res.redirect('/login?error=wrongData'); 
            res.end();
            return;
        } 
        req.logIn(user, (err) => {
            if(err) {
                res.end();
                return;
            }
            res.redirect('/manage');
            res.end();
            return;
        });
    })(req, res, next);
});
// end login page

// api
app.get('/api/lamp', (req,res) => {
    if(!req.query.token || !req.query.id || !db[req.query.id]) {
        res.end();
        return;
    }
    if(req.query.token === (db[req.query.id]['user']['username']+db[req.query.id]['user']['password'])) {
        res.json({'success': true, setting: db[req.query.id]['lamp']});
        res.end();
    } else {
        res.send('invalid token');
        res.end();
    }
})

app.get('/api/telegram/connect', (req, res) => {
    if(!req.query.code || !req.query.from || !tg_code[req.query.code]){
        res.json({success: false, error: "Error01#failcode"});
        res.end();
        return;
    }
    db[tg_code[req.query.code]]['user']['telegram'] = req.query.from;
    res.json({success: true, id: tg_code[req.query.code]})
    delete tg_code[req.query.code];
    res.end();
});

app.get('/api/telegram/getLampStatus', (req, res) => {
    if(!req.query.id || !req.query.from || !db[req.query.id]){
        res.json({success: false, error: "Error03#failQuery"});
        res.end();
        return;
    }
    if(db[req.query.id]['user']['telegram'] !== req.query.from) {
        res.json({success: false, error: "Error02#failUser"});
        res.end();
        return;
    }
    res.json({sucess: true, value: db[req.query.id]['lamp']['status']});
    res.end();
    return;
});

app.get('/api/telegram/edit', (req, res) => {
    if(!req.query.id || !req.query.from || !req.query.key || !req.query.value || !db[req.query.id]){
        res.json({success: false, error: "Error03#failQuery"});
        res.end();
        return;
    }
    if(db[req.query.id]['user']['telegram'] !== req.query.from) {
        res.json({success: false, error: "Error02#failUser"});
        res.end();
        return;
    }
    switch(req.query.key) {
        case 'brightness': {
            db[req.query.id]['lamp']['brightness'] = req.query.value;
            io.sockets.in(req.query.id).emit('getData', {
                key: req.query.key,
                value: req.query.value
            });
            res.json({success: true});
            break;
        }
        case 'color': {
            db[req.query.id]['lamp']['color'] = req.query.value;
            io.sockets.in(req.query.id).emit('getData', {
                key: req.query.key,
                value: req.query.value
            });
            res.json({success: true});
            break;
        }
        case 'status': {
            db[req.query.id]['lamp']['status'] = req.query.value;
            res.json({sucess: true});
            break;
        }
        default: res.end(); return;
    }
    res.end();
});
// end api

//logout
app.get('/logout', (req, res) => {
    if(!sessions[req.user]) {
        res.redirect('/');
        res.end();
        return;
    }
    delete sessions[req.user];
    req.logout();
    res.redirect('/');
    res.end();
});

//another page
app.get('*', (req,res) => {
    res.send('error');
    res.end();
})

//sockets
let users_online = 0;
io.on('connection', (socket) => {
    console.log('a user connected');
    users_online++;
  
    socket.on('disconnect', () => {
        console.log('user disconnected');
        users_online--;
    });
    
    socket.on('join', (data) => {
        socket.join(data.id);
    })
    
    socket.on('UpdateData', (data) => {
        if(!sessions[data.token]) {
            return;
        }
        if(sessions[data.token].lamp_id !== data.id) {
            return;
        }
        db[data.id]['lamp']['color'] = data.color;
        db[data.id]['lamp']['brightness'] = data.brightness;
    });

    
    setInterval(() => {
        socket.emit('onlineUsers', {users: users_online});
    }, 5000)
});


//start server
http.listen(8080, () => {
  console.log('listening on 8080');
});


// saving template database
setInterval(() => {
    fs.writeFileSync(__dirname+"/db.json", JSON.stringify(db, null, "\t"));
}, 10000)

const checkAuth = (req) => {
    let status = true;
    if(!req.user) {
        status = false;
    }
    if(!sessions[req.user]) {
        status = false;
    }
    return status;
}

const randomSession = () => {
    let result = '';
    const words = '0123456789qwertyuopiasdfghjkzxcvbnmQWERTYUOPASDFGHJKLZXCVBNM';
    const max_position = words.length - 1;
    for(let i = 0; i < 32; ++i ) {
        let position = Math.floor ( Math.random() * max_position );
        result = result + words.substring(position, position + 1);
    }
    return result;
}
