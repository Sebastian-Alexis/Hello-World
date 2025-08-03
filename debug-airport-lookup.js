// Debug script to test airport lookup functionality
// This script can be run in the browser console to test the airport form logic

console.log('🧪 Airport Debug Script Loaded');

// Test function to simulate airport selection
function testAirportSelection() {
  console.log('🔬 Testing Airport Selection Logic...');
  
  // Check if airports data is loaded
  console.log('📊 Airports Data Check:', {
    available: !!window.airportsData,
    count: window.airportsData?.length || 0,
    sample: window.airportsData?.slice(0, 2) || []
  });
  
  // Check datalist options
  const datalist = document.getElementById('airports-list');
  console.log('📋 Datalist Check:', {
    exists: !!datalist,
    options_count: datalist?.options?.length || 0,
    first_option: datalist?.options?.[0] ? {
      value: datalist.options[0].value,
      data_id: datalist.options[0].dataset.id
    } : null
  });
  
  // Test airport ID fields
  const airportIdFields = document.querySelectorAll('input[type="hidden"]');
  console.log('🏷️ Hidden Fields Check:');
  airportIdFields.forEach((field, index) => {
    if (field.name && field.name.includes('airport_id')) {
      console.log(`Field ${index + 1}:`, {
        name: field.name,
        value: field.value,
        class: field.className,
        parent_form: field.closest('.flight-form')?.dataset?.flightId
      });
    }
  });
  
  // Test manual airport selection
  const firstDepInput = document.querySelector('.departure-airport');
  const firstDepIdInput = document.querySelector('.departure-airport-id');
  
  if (firstDepInput && firstDepIdInput && datalist && datalist.options.length > 0) {
    console.log('🧪 Testing manual airport selection...');
    const testOption = datalist.options[0];
    
    console.log('Before selection:', {
      input_value: firstDepInput.value,
      hidden_value: firstDepIdInput.value
    });
    
    // Simulate selection
    firstDepInput.value = testOption.value;
    firstDepInput.dispatchEvent(new Event('change'));
    
    console.log('After selection:', {
      input_value: firstDepInput.value,
      hidden_value: firstDepIdInput.value,
      expected_id: testOption.dataset.id
    });
  }
}

// Test function to validate form submission data
function testFormSubmissionData() {
  console.log('📝 Testing Form Submission Data Collection...');
  
  const form = document.getElementById('trip-form');
  if (!form) {
    console.log('❌ Form not found');
    return;
  }
  
  const formData = new FormData(form);
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }
  
  // Test flight data collection
  const flightForms = document.querySelectorAll('.flight-form');
  console.log(`Found ${flightForms.length} flight forms`);
  
  flightForms.forEach((flightForm, index) => {
    const depIdField = flightForm.querySelector('.departure-airport-id');
    const arrIdField = flightForm.querySelector('.arrival-airport-id');
    
    console.log(`Flight ${index + 1} data:`, {
      departure_id: depIdField?.value,
      arrival_id: arrIdField?.value,
      departure_name: depIdField?.name,
      arrival_name: arrIdField?.name,
      departure_valid: !!(depIdField?.value && !isNaN(parseInt(depIdField.value))),
      arrival_valid: !!(arrIdField?.value && !isNaN(parseInt(arrIdField.value)))
    });
  });
}

// Test function to simulate flight fetch
function testFlightFetch() {
  console.log('✈️ Testing Flight Fetch Logic...');
  
  const firstFlightForm = document.querySelector('.flight-form');
  if (!firstFlightForm) {
    console.log('❌ No flight form found');
    return;
  }
  
  const flightNumberInput = firstFlightForm.querySelector('.flight-number');
  if (flightNumberInput) {
    flightNumberInput.value = 'AA1';
    console.log('Set test flight number: AA1');
    
    // Simulate clicking fetch button
    const fetchBtn = firstFlightForm.querySelector('.fetch-flight-btn');
    if (fetchBtn) {
      console.log('Simulating fetch button click...');
      fetchBtn.click();
    }
  }
}

// Export functions to global scope for console access
window.testAirportSelection = testAirportSelection;
window.testFormSubmissionData = testFormSubmissionData;
window.testFlightFetch = testFlightFetch;

console.log('🎯 Debug functions available:');
console.log('- testAirportSelection() - Test airport selection logic');
console.log('- testFormSubmissionData() - Test form data collection');
console.log('- testFlightFetch() - Test flight API fetch');