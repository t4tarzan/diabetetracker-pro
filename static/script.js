let glucoseChart;

document.addEventListener('DOMContentLoaded', function() {
    loadMeasurements();
    initializeChart();
    updateStats();
    
    // Navigation handling
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the target section ID
            const targetId = this.getAttribute('href').substring(1);
            
            // Update active state in navigation
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
            
            // Hide all sections
            document.querySelectorAll('section.section').forEach(section => {
                section.classList.add('d-none');
            });
            
            // Show target section
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('d-none');
                
                // Initialize PDF viewer if about section
                if (targetId === 'about') {
                    setTimeout(initPDFViewer, 100);
                }
            }
            
            // Close the navbar collapse on mobile
            const navbarCollapse = document.querySelector('.navbar-collapse');
            if (navbarCollapse.classList.contains('show')) {
                const bsCollapse = new bootstrap.Collapse(navbarCollapse);
                bsCollapse.hide();
            }
        });
    });

    // Show home section by default
    document.getElementById('home').classList.remove('d-none');
    
    document.getElementById('measurementForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveMeasurement();
    });

    // Auto-refresh data every 5 minutes
    setInterval(() => {
        loadMeasurements();
        updateStats();
    }, 300000);

    // PDF viewer initialization
    let pdfDoc = null,
        pageNum = 1,
        pageRendering = false,
        pageNumPending = null,
        scale = 1.0;

    function initPDFViewer() {
        const url = '/static/about.pdf';
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            pdfDoc = pdf;
            document.getElementById('page_count').textContent = pdf.numPages;
            renderPage(pageNum);
        });
    }

    function renderPage(num) {
        pageRendering = true;
        pdfDoc.getPage(num).then(function(page) {
            const canvas = document.getElementById('pdf-canvas');
            const ctx = canvas.getContext('2d');
            const viewport = page.getViewport({scale: scale});

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            page.render(renderContext).promise.then(function() {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });

            document.getElementById('page_num').textContent = num;
        });
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    // PDF viewer controls
    document.getElementById('prev').addEventListener('click', function() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    });

    document.getElementById('next').addEventListener('click', function() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    });

    document.getElementById('zoomIn').addEventListener('click', function() {
        scale *= 1.2;
        renderPage(pageNum);
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
        scale *= 0.8;
        renderPage(pageNum);
    });
});

function initializeChart() {
    const ctx = document.getElementById('glucoseChart').getContext('2d');
    glucoseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Blood Glucose',
                data: [],
                borderColor: '#4361ee',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Blood Glucose Trends'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'mg/dL'
                    }
                }
            }
        }
    });
}

function updateChart(measurements) {
    const labels = measurements.map(m => new Date(m.timestamp).toLocaleTimeString());
    const data = measurements.map(m => m.glucose);
    
    glucoseChart.data.labels = labels;
    glucoseChart.data.datasets[0].data = data;
    glucoseChart.update();
}

function saveMeasurement() {
    const data = {
        glucose: parseFloat(document.getElementById('glucose').value),
        carbs: parseInt(document.getElementById('carbs').value) || 0,
        insulin: parseFloat(document.getElementById('insulin').value) || 0,
        activity: document.getElementById('activity').value
    };

    fetch('/api/add_measurement', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        loadMeasurements();
        document.getElementById('measurementForm').reset();
    })
    .catch(error => console.error('Error:', error));
}

function loadMeasurements() {
    fetch('/api/get_measurements')
        .then(response => response.json())
        .then(data => {
            updateChart(data);
            const tbody = document.getElementById('measurementsTable');
            tbody.innerHTML = '';
            
            data.forEach(measurement => {
                const row = document.createElement('tr');
                const time = new Date(measurement.timestamp).toLocaleString();
                row.innerHTML = `
                    <td>${time}</td>
                    <td>${measurement.glucose} mg/dL</td>
                    <td>${measurement.carbs}g</td>
                    <td>${measurement.insulin}u</td>
                    <td>${measurement.activity || '-'}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => console.error('Error:', error));
}

function updateStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('avgGlucose').textContent = `${data.last24h.average} mg/dL`;
            document.getElementById('maxGlucose').textContent = `${data.last24h.max} mg/dL`;
            document.getElementById('minGlucose').textContent = `${data.last24h.min} mg/dL`;
            document.getElementById('readingCount').textContent = data.last24h.readings;
        })
        .catch(error => console.error('Error:', error));
}

function calculateInsulin() {
    const carbs = parseFloat(document.getElementById('calcCarbs').value) || 0;
    const intensity = parseFloat(document.getElementById('intensity').value);
    const timeOfDay = document.getElementById('timeOfDay').value;
    
    // Enhanced calculation considering time of day and exercise
    let baseInsulin = carbs / 10; // Base ratio: 1 unit per 10g carbs
    
    // Time of day adjustment
    const timeFactors = {
        'morning': 1.2,  // Higher insulin resistance in morning
        'afternoon': 1.0,
        'evening': 0.9,  // Better insulin sensitivity in evening
        'night': 0.8     // Reduced insulin needs at night
    };
    
    // Calculate final insulin recommendation
    const timeAdjusted = baseInsulin * timeFactors[timeOfDay];
    const finalInsulin = timeAdjusted * intensity;
    
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <div class="alert alert-info">
            <h6 class="mb-2">Insulin Calculation Results:</h6>
            <p class="mb-1">Base insulin: ${baseInsulin.toFixed(1)} units</p>
            <p class="mb-1">Time adjustment: ${timeFactors[timeOfDay]}x</p>
            <p class="mb-1">Exercise adjustment: ${intensity}x</p>
            <p class="mb-2"><strong>Recommended Insulin: ${finalInsulin.toFixed(1)} units</strong></p>
            <small class="text-muted">This is a suggestion based on standard calculations. Always consult your healthcare provider.</small>
        </div>
    `;
}

function generateMealPlan() {
    const mealType = document.getElementById('mealType').value;
    const targetCarbs = parseInt(document.getElementById('targetCarbs').value) || 0;
    
    const mealSuggestions = {
        breakfast: [
            { name: 'Oatmeal with berries', carbs: 30, protein: 'Add Greek yogurt' },
            { name: 'Whole grain toast with eggs', carbs: 25, protein: 'Eggs provide protein' },
            { name: 'Smoothie bowl', carbs: 35, protein: 'Add protein powder' }
        ],
        lunch: [
            { name: 'Quinoa bowl', carbs: 45, protein: 'Add grilled chicken' },
            { name: 'Whole grain wrap', carbs: 35, protein: 'Add turkey and avocado' },
            { name: 'Brown rice and vegetables', carbs: 40, protein: 'Add tofu or fish' }
        ],
        dinner: [
            { name: 'Sweet potato and lean protein', carbs: 30, protein: 'Choose lean meat' },
            { name: 'Whole grain pasta', carbs: 45, protein: 'Add lean ground turkey' },
            { name: 'Buddha bowl', carbs: 40, protein: 'Add chickpeas' }
        ],
        snack: [
            { name: 'Apple with nut butter', carbs: 15, protein: 'Nuts provide protein' },
            { name: 'Greek yogurt with granola', carbs: 20, protein: 'High protein snack' },
            { name: 'Whole grain crackers', carbs: 15, protein: 'Add cheese' }
        ]
    };

    const suggestions = mealSuggestions[mealType];
    const closest = suggestions.reduce((prev, curr) => {
        return Math.abs(curr.carbs - targetCarbs) < Math.abs(prev.carbs - targetCarbs) ? curr : prev;
    });

    const mealSuggestionsDiv = document.getElementById('mealSuggestions');
    mealSuggestionsDiv.innerHTML = `
        <div class="alert alert-success">
            <h6 class="mb-2">Meal Suggestions for ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}:</h6>
            <p class="mb-1"><strong>${closest.name}</strong></p>
            <p class="mb-1">Carbs: ${closest.carbs}g</p>
            <p class="mb-1">Protein suggestion: ${closest.protein}</p>
            <small class="text-muted">Adjust portions to match your exact carb needs.</small>
        </div>
    `;
}

function generateWorkoutPlan() {
    const workoutType = document.getElementById('workoutType').value;
    const duration = parseInt(document.getElementById('duration').value) || 30;
    const intensity = document.getElementById('workoutIntensity').value;
    
    const workoutPlans = {
        cardio: {
            low: {
                description: 'Light cardio session',
                activities: ['Walking', 'Light cycling', 'Swimming'],
                glucoseImpact: 'Minimal impact on blood glucose'
            },
            medium: {
                description: 'Moderate cardio workout',
                activities: ['Jogging', 'Cycling', 'Dancing'],
                glucoseImpact: 'May lower blood glucose by 30-50 mg/dL'
            },
            high: {
                description: 'High-intensity cardio',
                activities: ['Running', 'HIIT', 'Spinning'],
                glucoseImpact: 'Can lower blood glucose by 50-100 mg/dL'
            }
        },
        strength: {
            low: {
                description: 'Light strength training',
                activities: ['Bodyweight exercises', 'Light resistance bands', 'Basic yoga'],
                glucoseImpact: 'Minimal impact on blood glucose'
            },
            medium: {
                description: 'Moderate strength training',
                activities: ['Weight training', 'Advanced bodyweight', 'Power yoga'],
                glucoseImpact: 'May lower blood glucose by 20-40 mg/dL'
            },
            high: {
                description: 'High-intensity strength',
                activities: ['Heavy lifting', 'Circuit training', 'CrossFit'],
                glucoseImpact: 'Can lower blood glucose by 40-80 mg/dL'
            }
        },
        mixed: {
            low: {
                description: 'Light mixed workout',
                activities: ['Walking with light weights', 'Yoga flow', 'Stretching'],
                glucoseImpact: 'Minimal impact on blood glucose'
            },
            medium: {
                description: 'Moderate mixed session',
                activities: ['Circuit training', 'Sports games', 'Swimming'],
                glucoseImpact: 'May lower blood glucose by 30-60 mg/dL'
            },
            high: {
                description: 'High-intensity mixed',
                activities: ['HIIT with weights', 'Sports training', 'Boot camp'],
                glucoseImpact: 'Can lower blood glucose by 50-100 mg/dL'
            }
        }
    };

    const plan = workoutPlans[workoutType][intensity];
    
    const workoutPlanDiv = document.getElementById('workoutPlan');
    workoutPlanDiv.innerHTML = `
        <div class="alert alert-warning">
            <h6 class="mb-2">${plan.description} (${duration} minutes)</h6>
            <p class="mb-1"><strong>Recommended Activities:</strong></p>
            <ul class="mb-2">
                ${plan.activities.map(activity => `<li>${activity}</li>`).join('')}
            </ul>
            <p class="mb-1"><strong>Expected Glucose Impact:</strong> ${plan.glucoseImpact}</p>
            <div class="mt-2">
                <strong>Safety Tips:</strong>
                <ul class="mb-0">
                    <li>Check blood glucose before starting</li>
                    <li>Have fast-acting carbs nearby</li>
                    <li>Monitor glucose during longer sessions</li>
                    <li>Stay hydrated</li>
                </ul>
            </div>
        </div>
    `;
}
