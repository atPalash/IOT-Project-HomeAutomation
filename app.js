var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var weather = require("openweather-node");
var iGoogleNewsRSSScraper = require('googlenews-rss-scraper');

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();
var hostname = 'localhost';
var port = 3000;
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var serialport = require('serialport');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

var myPort = new serialport("COM3", {
    baudrate: 9600,
    parser: serialport.parsers.readline("\n")
}, function (res) {
    console.log(res);
});

myPort.on('open', onOpen);
myPort.on('data', onData);

function onOpen(){
    console.log("Connected to board: Ardunio/Genuino Uno");
}

function onData(data) {
    io.sockets.emit('port', data);
    console.log(data);
}

weather.setAPPID("eff90048d596e6b496a3bd92d23e219e");
weather.setCulture("en");
weather.setForecastType("daily");

function currentWeather() {
    setInterval(function () {
        weather.now("Tampere",function(err, aData)
        {
            if(err) console.log(err);
            else
            {
                var tempCelsius = (aData.values.main.temp-273.15).toFixed(0);
                var humidity = aData.values.main.humidity;

                console.log("the temperature is", tempCelsius,"*C");
                console.log("the humidity ", humidity);

                io.sockets.emit('temperature_port', tempCelsius);
                //console.log(tempCelsius);
                io.sockets.emit('humidity_port', humidity);
            }
        });
    },6000);
}

currentWeather();

function forecastWeather() {
    setInterval(function () {
        weather.forecast("Tampere", function (err, forecastData) {
            if (err) console.log(err);
            else {
                var date = new Date();
                var today = date.getDay();
                var tommorrow = today+1;
                var dayAfterTommorrow = today+2;

                if(today == 6){
                    tommorrow = 0;
                    dayAfterTommorrow = 1;
                }
                if(today == 5){
                    tommorrow = 6;
                    dayAfterTommorrow = 0;
                }
                var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                var sendDays = [days[today], days[tommorrow], days[dayAfterTommorrow]];

                var forecastWeatherJSON = [];
                for(var i=0; i<3; i++)
                {
                    forecastWeatherJSON[i] = {"forecast":forecastData.values.list[i].weather[0].description, "day" : sendDays[i]};
                }
                io.sockets.emit('forecast_port', forecastWeatherJSON);
            }
        });
    },6000);
}
forecastWeather();

function currentNews() {
    setInterval(function () {
        iGoogleNewsRSSScraper.getGoogleNewsRSSScraperData({newsType: 'TOPIC', newsTypeTerms: 'WORLD'}, function (data) {
            if (!data.error) {
                //console.log(JSON.stringify(data, null, 2));
                //console.log(data.newsArray.length);
                var newsJSON = [];
                for (var i = 0; i < data.newsArray.length; i++) {
                    newsJSON[i] = {"news": data.newsArray[i].title};
                }
                io.sockets.emit('news_port', newsJSON);
            }
            else {
                console.log('Some error occured.');
            }
        });
    },6000);
}

currentNews();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

server.listen(port, hostname, function(){
    console.log(`Server running at http://${hostname}:${port}/`);
});

module.exports = app;
