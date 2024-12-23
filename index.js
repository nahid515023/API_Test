const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs');
const { parse } = require('json2csv')

// Middleware
app.use(bodyParser.json()) // Parse JSON request bodies

// Helper function for exponential backoff retries
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, options)
      return response // Successful response
    } catch (error) {
      // Handle specific error codes
      if (error.response && error.response.status === 403) {
        console.error('403 Forbidden - Skipping request:', error.message)
        throw new Error('Forbidden Access') // Exit retry loop
      } else if (error.response && error.response.status === 500) {
        console.error('500 Internal Server Error - Retrying request:', error.message)
      } else {
        console.error('Unexpected error:', error.message)
        throw error // Re-throw unexpected errors
      }

      // Wait for exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries reached') // After retries are exhausted
}

// GET route
app.get('/', async (req, res) => {
  try {
    // Example query for GraphQL API
    const query = `
        {
          countries {
                name
                capital
                currency
          }
        }`;

    // Fetch data with retry mechanism
    const response = await fetchWithRetry(
      'https://countries.trevorblades.com/',
      { query: query }
    );

    // Extract countries data
    const countries = response.data.data.countries;

    // Prepare CSV data
    const csvFields = ['Country Name', 'Capital', 'Currency'];
    const csvData = countries.map(country => ({
      'Country Name': country.name,
      'Capital': country.capital || 'N/A',
      'Currency': country.currency || 'N/A'
    }));

    // Convert to CSV
    const csv = parse(csvData, { fields: csvFields });

    // Save CSV to a file
    fs.writeFileSync('countries.csv', csv);

    console.log('CSV file saved successfully.');

    // Send success message
    res.json({ message: 'CSV file saved successfully!', data: countries });
  } catch (error) {
    console.error('Error fetching or saving data:', error.message);
    res.status(500).send('Server Error');
  }
});

// POST route
app.post('/', async (req, res) => {
  try {
    const { title, body, userId } = req.body;
    const post = {
      title,
      body,
      userId
    };

    console.log('Received POST data:', post);

    // Retry mechanism for POST request
    const data = await fetchWithRetry(
      'https://jsonplaceholder.typicode.com/posts',
      post
    );

    res.json({ id: data.data.id });
  } catch (err) {
    console.error('POST request failed:', err.message);
    res.status(500).send('Failed to create post.');
  }
});

// Automated workflow
async function automateWorkflow() {
    try {
      console.log('Fetching data from GraphQL API...');
  
      // GraphQL Query
      const query = `
        {
          countries {
            name
            capital
            currency
          }
        }`;
  
      // Fetch data from GraphQL API with retry
      const response = await fetchWithRetry(
        'https://countries.trevorblades.com/',
        { query: query }
      );
  
      // Extract data and select one country
      const countries = response.data.data.countries;
      if (countries.length === 0) {
        throw new Error('No countries found!');
      }
  
      const selectedCountry = countries[0]; // Select the first country
      console.log('Selected Country:', selectedCountry);
  
      // Prepare data for POST request
      const postData = {
        title: selectedCountry.name,
        body: `Capital: ${selectedCountry.capital || 'N/A'}, Currency: ${selectedCountry.currency || 'N/A'}`,
        userId: 1
      };
  
      console.log('Posting data to REST API...');
  
      // Post data to REST API with retry
      const postResponse = await fetchWithRetry(
        'https://jsonplaceholder.typicode.com/posts',
        postData
      );
  
      console.log('Data posted successfully! Post ID:', postResponse.data.id);
  
      return { message: 'Workflow completed successfully!', postId: postResponse.data.id };
    } catch (error) {
      console.error('Error during workflow execution:', error.message);
      throw error;
    }
  }

app.get('/automate', async (req, res) => {
    try {
      const result = await automateWorkflow();
      res.json(result); // Send the result as JSON response
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
