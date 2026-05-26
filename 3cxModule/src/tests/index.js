const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ThreeCX = require('../index');

async function runTests() {
    ThreeCX.init({
        baseUrl: process.env.THREECX_BASE_URL,
        extension: process.env.THREECX_EXTENSION,
        password: process.env.THREECX_PASSWORD,
    });

    // Test 1 : Historique des appels
    console.log("\n--- Test 1 : getCallHistory ---");
    try {
        const history = await ThreeCX.getCallHistory({ pageSize: 5, page: 0 });
        console.log(`Total : ${history.totalCount} appels`);
        console.log('Premiers resultats :', JSON.stringify(history.list.slice(0, 2), null, 2));
    } catch (err) {
        console.log('Erreur :', err.message);
    }

    // Test 2 : Enregistrements
    console.log("\n--- Test 2 : getRecordings ---");
    try {
        const recordings = await ThreeCX.getRecordings({ pageSize: 5 });
        console.log(`Total : ${recordings.totalCount} enregistrements`);
        console.log('Premiers resultats :', JSON.stringify(recordings.list.slice(0, 2), null, 2));
    } catch (err) {
        console.log('Erreur :', err.message);
    }

    // Test 3 : Extensions
    console.log("\n--- Test 3 : getExtensions ---");
    try {
        const extensions = await ThreeCX.getExtensions();
        console.log(`${extensions.length} extension(s) trouvee(s)`);
        console.log('Premiers resultats :', JSON.stringify(extensions.slice(0, 3), null, 2));
    } catch (err) {
        console.log('Erreur :', err.message);
    }

    // Test 4 : Appels actifs
    console.log("\n--- Test 4 : getActiveCalls ---");
    try {
        const active = await ThreeCX.getActiveCalls();
        console.log(`${active.length} appel(s) en cours`);
    } catch (err) {
        console.log('Erreur :', err.message);
    }

    // Test 5 : Statut systeme
    console.log("\n--- Test 5 : getSystemStatus ---");
    try {
        const status = await ThreeCX.getSystemStatus();
        console.log('Statut :', JSON.stringify(status, null, 2));
    } catch (err) {
        console.log('Erreur :', err.message);
    }
}

runTests()
    .then(() => console.log("\nTous les tests termines."))
    .catch(console.error);
