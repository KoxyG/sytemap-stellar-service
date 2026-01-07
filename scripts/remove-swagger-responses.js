const fs = require('fs');
const path = require('path');

const swaggerFile = path.resolve(__dirname, '../src/swagger/documentation.swagger.json');

// Read the swagger file
const swaggerDoc = JSON.parse(fs.readFileSync(swaggerFile, 'utf8'));

// Function to recursively remove 'responses' keys
function removeResponses(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => removeResponses(item));
  } else {
    // Delete 'responses' key if it exists
    if ('responses' in obj) {
      delete obj.responses;
    }

    // Recursively process all values
    Object.values(obj).forEach((value) => {
      removeResponses(value);
    });
  }
}

// Remove all responses
removeResponses(swaggerDoc);

// Write back to file
fs.writeFileSync(swaggerFile, JSON.stringify(swaggerDoc, null, 2), 'utf8');

console.log('✅ Successfully removed all responses from swagger.json');
