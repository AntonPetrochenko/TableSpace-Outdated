var express = require('express')
var app = express()

app.use(express.static('/uploads'))

app.listen(69)