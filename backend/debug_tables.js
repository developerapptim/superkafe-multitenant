const mongoose = require('mongoose');
// require('dotenv').config();
const Table = require('./models/Table');

// Hardcoded URI from .env
const uri = "mongodb+srv://developerapptim:developerapptim1@cluster0.6ifoomz.mongodb.net/test?retryWrites=true&w=majority";

const run = async () => {
    try {
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const fs = require('fs');

        const tables = await Table.find({});
        let output = '--- TABLES DUMP ---\n';
        tables.forEach(t => {
            output += `[TABLE] ID:${t.id} NUMBER:'${t.number}' STATUS:${t.status} _ID:${t._id}\n`;
        });
        output += '-------------------\n';
        output += `Total Tables: ${tables.length}\n`;

        fs.writeFileSync('table_dump.txt', output);
        console.log('Dump written to table_dump.txt');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
