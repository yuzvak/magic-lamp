const TgBot = require('node-telegram-bot-api'),
      token = "1180139988:AAHqK0UqszqI04eibuMAyXU_qXuHnTmTI0w",
      bot = new TgBot(token, {polling: true});

const Promise = require('bluebird');
const request = require('request');
const fs = require('fs');

const db = require('./db_tg.json')

Promise.config({
  cancellation: true
});

const add_user = [];

//delete after release
const test_mode_users = [];
let temp_lamp = "off";

bot.onText(/\/повтори (.+)/, function (msg, match) {
    bot.sendMessage(msg.from.id, match[1]);
});

//Стандартний початок
bot.onText(/\/start/, function (msg, match) {
    if(add_user.indexOf(msg.from.id) > -1) {
        bot.sendMessage(msg.from.id, 
                "Еее ні. Це не код лампи."
                +"\n\nЯкщо ти передумав додавати лампу - напиши «cancel»");
        return;
    }
    bot.sendMessage(msg.from.id, 
                    "Привіт, я - бот від Y-Tech.\n"
                    +"Я допоможу тобі в управлінні твоєю лампою, поїхали?", {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            inline_keyboard: [
                [{text: "Вперед!", callback_data: 'go'}],
            ]
        })
    });
});

bot.onText(/\/menu/, function (msg, match) {
    if(getAuth(msg.from.id) === false) return;
    bot.sendMessage(msg.from.id, "Меню керування Вашою лампою\n\nВиберіть бажану дію",{
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "Змінити колір", callback_data: 'set_color'},{text: "Змінити яскравість", callback_data: 'set_brightness'}],
                        (getLampStatus(msg.from.id) === 'off' ? ([{text: "Ввімкнути лампу", callback_data: 'lamp_on'}]):([{text: "Ввимкнути лампу", callback_data: 'lamp_off'}]) )
                    ]
                })
            }) 
});

bot.on('message', function (msg) {
    if(add_user.indexOf(msg.from.id) > -1) {
        if(msg.text.length !== 6 || msg.text.indexOf('/') > -1) {
            bot.sendMessage(msg.from.id, 
                            "Еее ні. Це не код лампи."
                           +"\n\nЯкщо ти передумав додавати лампу - напиши «cancel»");
            return;
        }
        if(msg.text.toLowerCase() === 'cancel') {
            bot.sendMessage(msg.from.id, 
                            "Без лампи ти не зможеш користуватись ботом 😞");
            for(let i in add_user){
                if(add_user[i] === msg.from.id) {
                    add_user.splice(i, 1)
                }
            }
        }
        request.get('http://localhost:8080/api/telegram/connect?from='+msg.from.id+'&code='+msg.text, (e,r,b) => {
            let data = JSON.parse(b);
            if(!data) {
                bot.sendMessage(msg.from.id, "Непередбачувана помилка.");
                return;
            }
            if(data.success === false) {
                bot.sendMessage(msg.from.id, "Непередбачувана помилка. ("+data.error+" [for dev])");
            }
            else if(data.success === true) {
                db[msg.from.id] = data.id;
                bot.sendMessage(msg.from.id, "Ви прив'язали лампу #"+data.id);
                bot.sendMessage(msg.from.id, 
                                "Ви прив'язали лампу #"+data.id, {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{text: "Меню", callback_data: 'menu'}],
                        ]
                    })
                });
                for(let i in add_user){
                    if(add_user[i] === msg.from.id) {
                        add_user.splice(i, 1)
                    }
                }
            }
        })
        return;
    }
    if(msg.text.indexOf('/') === -1){
        bot.sendPhoto(msg.chat.id, __dirname+'/kavo.png', { caption: 'Каво?' });
        return;
    }
});

bot.on('callback_query', async function (msg) {
    switch(msg.data) {
        case 'go': {
            bot.sendMessage(msg.from.id, 
                            "Окей! Давай додамо твою лампу!\n", {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "Додати лампу", callback_data: 'add'}],
                        [{text: "skip (for dev)", callback_data: 'skip'}],
                    ]
                })
            });
            break;
        }
        case 'add': {
            if(db[msg.from.id]) {
                bot.sendMessage(msg.from.id, 
                                "У Вас вже є привязана лампа.", {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{text: "Меню", callback_data: 'menu'}]
                        ]
                    })
                });
                for(i in add_user){
                    if(add_user[i] === msg.from.id) {
                        add_user.splice(i, 1)
                    }
                }
                return;
            }
            bot.sendMessage(msg.from.id,
                           "Введи код лампи, який вказаний в твоєму особистому кабінеті"
                            + "\n\nЯкщо ти передумав - напиши «cancel»"
                           );
            add_user.push(msg.from.id);
            break;
        }
        case 'skip': {
             bot.sendMessage(msg.from.id,
                           "Ви ввійшли в режим розробника."
                            + "\nВін доступний тільки до релізу лампи."
                           );
             test_mode_users.push(msg.from.id);
            break;
        }
        case 'lamp_on': {
            if(getAuth(msg.from.id) === false) return;
            request.get('http://localhost:8080/api/telegram/edit?id='+db[msg.from.id]+'&from='+msg.from.id+'&key=status&value=on', (e,r,b) => {
                if(!b) return;
                let data = JSON.parse(b);
                if(!data) {
                    bot.sendMessage(msg.from.id, "Непередбачувана помилка. (#0 [for dev])");
                    return;
                }
                if(data.success === false) {
                    bot.sendMessage(msg.from.id, "Непередбачувана помилка. ("+data.error+" [for dev])");
                }
                else if(data.success === true) {
                    bot.sendMessage(msg.from.id, "Лампа ввімкнена.\n\nВиберіть бажану дію",{
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [{text: "Змінити колір", callback_data: 'set_color'},{text: "Змінити яскравість", callback_data: 'set_brightness'}],
                                (getLampStatus(msg.from.id) === 'off' ? ([{text: "Ввімкнути лампу", callback_data: 'lamp_on'}]):([{text: "Ввимкнути лампу", callback_data: 'lamp_off'}]) )
                            ]
                        })
                    })
                }
            })
            break;
        }
        case 'lamp_off': {
            if(getAuth(msg.from.id) === false) return;
            request.get('http://localhost:8080/api/telegram/edit?id='+db[msg.from.id]+'&from='+msg.from.id+'&key=status&value=off', (e,r,b) => {
                if(!b) return;
                let data = JSON.parse(b);
                if(!data) {
                    bot.sendMessage(msg.from.id, "Непередбачувана помилка. (#0 [for dev])");
                    return;
                }
                if(data.success === false) {
                    bot.sendMessage(msg.from.id, "Непередбачувана помилка. ("+data.error+" [for dev])");
                }
                else if(data.success === true) {
                    bot.sendMessage(msg.from.id, "Лампа ввимкнена.\n\nВиберіть бажану дію",{
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [{text: "Змінити колір", callback_data: 'set_color'},{text: "Змінити яскравість", callback_data: 'set_brightness'}],
                                (getLampStatus(msg.from.id) === 'off' ? ([{text: "Ввімкнути лампу", callback_data: 'lamp_on'}]):([{text: "Ввимкнути лампу", callback_data: 'lamp_off'}]) )
                            ]
                        })
                    })
                }
            })
            break;
        }
        case 'menu': {
            if(getAuth(msg.from.id) === false) return;
            bot.sendMessage(msg.from.id, "Меню\n\nВиберіть бажану дію",{
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "Змінити колір", callback_data: 'set_color'},{text: "Змінити яскравість", callback_data: 'set_brightness'}],
                        (temp_lamp === 'off' ? ([{text: "Ввімкнути лампу", callback_data: 'lamp_on'}]):([{text: "Ввимкнути лампу", callback_data: 'lamp_off'}]) )
                    ]
                })
            }) 
            break;
        }
        case 'set_color': {
            if(getAuth(msg.from.id) === false) return;
            bot.sendMessage(msg.from.id, "Виберіть колір",{
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "Білий", callback_data: 'set_color_white'},{text: "Червоний", callback_data: 'set_color_red'},{text: "Зелений", callback_data: 'set_color_green'}],
                        [{text: "Жовтий", callback_data: 'set_color_yellow'},{text: "Синій", callback_data: 'set_color_blue'},{text: "Оранжевий", callback_data: 'set_color_orange'}],
                        [{text: "Ефект «Fade»", callback_data: 'set_color_fade'},{text: "Ефект «Gradient»", callback_data: 'set_color_gradient'}],
                        [{text: "Меню", callback_data: 'menu'}]
                    ]
                })
            }) 
            break;
        }
        case 'set_brightness': {
            if(getAuth(msg.from.id) === false) return;
            bot.sendMessage(msg.from.id, "Виберіть доступну яскравість:",{
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "0%", callback_data: 'set_brightness_0'}],
                        [{text: "10%", callback_data: 'set_brightness_10'},{text: "20%", callback_data: 'set_brightness_20'},{text: "30%", callback_data: 'set_brightness_30'}],
                        [{text: "40%", callback_data: 'set_brightness_40'},{text: "50%", callback_data: 'set_brightness_50'},{text: "60%", callback_data: 'set_brightness_60'}],
                        [{text: "70%", callback_data: 'set_brightness_70'},{text: "80%", callback_data: 'set_brightness_80'},{text: "90%", callback_data: 'set_brightness_90'}],
                        [{text: "100%", callback_data: 'set_brightness_100'}],
                        [{text: "Меню", callback_data: 'menu'}]
                    ]
                })
            }) 
            break;
        }
        default: {
            if(msg.data.search('set_brightness_') > -1) {
                if(getAuth(msg.from.id) === false) return;
                let value = msg.data.match(/set\_brightness\_([^]+)/)[1];
                request.get('http://localhost:8080/api/telegram/edit?id='+db[msg.from.id]+'&from='+msg.from.id+'&key=brightness&value='+value, (e,r,b) => {
                    if(!b) return;
                    let data = JSON.parse(b);
                    if(!data) {
                        bot.sendMessage(msg.from.id, "Непередбачувана помилка. (#0 [for dev])");
                        return;
                    }
                    if(data.success === false) {
                        bot.sendMessage(msg.from.id, "Непередбачувана помилка. ("+data.error+" [for dev])");
                    }
                    else if(data.success === true) {
                        bot.sendMessage(msg.from.id, "Ви вибрали яскравість "+value+"%")
                    }
                })
                return;
            }
            if(msg.data.search('set_color_') > -1) {
                if(getAuth(msg.from.id) === false) return;
                let value = msg.data.match(/set\_color\_([^]+)/)[1];
                request.get('http://localhost:8080/api/telegram/edit?id='+db[msg.from.id]+'&from='+msg.from.id+'&key=color&value='+value, (e,r,b) => {
                    if(!b) return;
                    let data = JSON.parse(b);
                    if(!data) {
                        bot.sendMessage(msg.from.id, "Непередбачувана помилка. (#0 [for dev])");
                        return;
                    }
                    if(!data.success) {
                        bot.sendMessage(msg.from.id, "Непередбачувана помилка. ("+data.error+" [for dev])");
                    }
                    else if(data.success) {
                        bot.sendMessage(msg.from.id, "Ви вибрали колір: "+value+"")
                        return;
                    }  
                })
                return;
            }
            bot.sendMessage(msg.from.id, "В розробці.");
            break;
        }
    }
});

const getLampStatus = (user) => {
    let status = null;
    request.get('http://localhost:8080/api/telegram/getLampStatus?id='+db[user]+'&from='+user, (e,r,b) => {
        console.log(b)
        if(!b) return;
        let data = JSON.parse(b);
        if(!data) {
            return null;
        }
        if(data.success === false) {
            return null;
        }
        else if(data.success === true) {
            status = data.value;
        }
    })
    return status;
}

const getAuth = (user) => {
    let status = true;
    if(!db[user]){
        bot.sendMessage(user, "Ви не додали лампу!\nНатисність кнопку «додати лампу», щоб авторизуватись", {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{text: "Додати лампу", callback_data: 'add'}]
                    ]
                })
            });
        status = false;
    }
    return status;
}

setInterval(() => {
    fs.writeFileSync(__dirname+"/db_tg.json", JSON.stringify(db, null, "\t"));
}, 10000)

/*
``````````{\
````````{\{*\
````````{*\~\__&&&
```````{```\`&&&&&&.
``````{~`*`\((((((^^^)
`````{`*`~((((((( ♛ ♛
````{`*`~`)))))))). _' )
````{*```*`((((((('\ ~
`````{~`*``*)))))`.&
``````{.*~``*((((`\`\)) ?
````````{``~* ))) `\_.-'``
``````````{.__ ((`-*.*
````````````.*```~``*.
``````````.*.``*```~`*.
`````````.*````.````.`*.
````````.*``~`````*````*.
```````.*``````*`````~``*.
`````.*````~``````.`````*.
```.*```*```.``~```*``~ *.¤´҉ .
*/
