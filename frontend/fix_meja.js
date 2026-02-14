const fs = require('fs');
const path = 'd:\\DevAppTim\\warkop react -  Capacitor\\frontend\\src\\pages\\admin\\Meja.jsx';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');

    // We want to remove lines 402 to 418 (1-based index).
    // In 0-based index: 401 to 417.
    // Validate content at 401
    if (lines[401].trim() === '// Sound Alert for New Reservations') {
        console.log('Found start of block at line 402');
    } else {
        // Search for the line if index is slightly off
        const idx = lines.findIndex(l => l.includes('// Sound Alert for New Reservations'));
        if (idx !== -1) {
            console.log(`Found block at line ${idx + 1}`);
            // Remove from idx to idx + 16 (approx)
            // Check end
            // We want to remove until we see `// ... (rest of the component)` or just the hook end.
            let endIdx = idx;
            for (let i = idx; i < lines.length; i++) {
                if (lines[i].includes('// ... (rest of the component)')) {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx > idx) {
                console.log(`Removing lines ${idx + 1} to ${endIdx + 1}`);
                lines.splice(idx, endIdx - idx + 1);
                fs.writeFileSync(path, lines.join('\n'), 'utf8');
                console.log('File updated successfully.');
            } else {
                console.log('Could not find end of block');
            }
        } else {
            console.log('Could not find start of block');
        }
    }

} catch (err) {
    console.error(err);
}
