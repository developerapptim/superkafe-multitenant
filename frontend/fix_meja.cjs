const fs = require('fs');
const path = 'd:\\DevAppTim\\warkop react -  Capacitor\\frontend\\src\\pages\\admin\\Meja.jsx';

try {
    const data = fs.readFileSync(path, 'utf8');
    let lines = data.split('\n');

    let startIdx = -1;
    let firstFound = false;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '// Sound Alert for New Reservations') {
            if (!firstFound) {
                console.log(`Skipping first occurrence at line ${i + 1}`);
                firstFound = true;
                continue;
            }
            startIdx = i;
            break;
        }
    }

    if (startIdx !== -1) {
        console.log(`Found second occurrence at line ${startIdx + 1}`);
        console.log(`Removing 15 lines starting from line ${startIdx + 1}`);

        // Safety check: print the lines to be removed
        for (let k = 0; k < 15; k++) {
            // console.log(`- ${lines[startIdx + k]}`);
        }

        lines.splice(startIdx, 15);
        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log('Success!');
    } else {
        console.log('Second occurrence not found.');
    }

} catch (err) {
    console.error(err);
}
