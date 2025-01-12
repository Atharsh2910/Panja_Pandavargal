const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mysql = require('mysql');
const path = require('path');

const app = express();
const port = 3000;

const upload = multer();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Update MySQL username
    password: '1157hemach1606^', // Update MySQL password
    database: 'patient_management' // Update database name
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

// Serve the HTML form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit_form', upload.none(), (req, res) => {
    const data = req.body;

    // Insert into personal_details table
    const personalDetailsQuery = `
        INSERT INTO personal_details (full_name, dob, address, phone_number, email, gender)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const personalDetailsValues = [
        data.fullName, data.dob, data.address, data.phoneNumber, data.email, data.gender
    ];

    db.query(personalDetailsQuery, personalDetailsValues, (err, result) => {
        if (err) {
            console.error('Error inserting personal details:', err);
            return res.status(500).json({ message: 'Failed to save personal details.' });
        }

        const personalId = result.insertId; // Get the auto-generated personal_id

        // Log the first visit in the DoctorVisits table
        const visitDate = new Date().toISOString().split('T')[0]; // Current date for the first visit
        const observations = data.observationsDuringVisits || ''; // Default to empty if not provided
        const doctorNotes = data.doctorNotes || ''; // Default to empty if not provided

        const doctorVisitQuery = `
            INSERT INTO DoctorVisits (patient_id, visit_date, observations, doctor_notes)
            VALUES (?, ?, ?, ?)
        `;
        db.query(doctorVisitQuery, [personalId, visitDate, observations, doctorNotes], (err) => {
            if (err) {
                console.error('Error inserting doctor visit:', err);
                return res.status(500).json({ message: 'Failed to log first visit.' });
            }
        });

        // Insert into emergency_contact table
        const emergencyContactQuery = `
            INSERT INTO emergency_contact (personal_id, contact_name, relationship, phone_number)
            VALUES (?, ?, ?, ?)
        `;
        const emergencyContactValues = [
            personalId, data.emergencyContactName, data.emergencyContactRelationship, data.emergencyContactPhoneNumber
        ];
        db.query(emergencyContactQuery, emergencyContactValues, (err) => {
            if (err) console.error('Error inserting emergency contact:', err);
        });

        // Insert into diagnosis table
        const diagnosisQuery = `
            INSERT INTO diagnosis (personal_id, diagnoses, treatment_plans, prescriptions)
            VALUES (?, ?, ?, ?)
        `;
        const diagnosisValues = [personalId, data.diagnoses, data.treatmentPlans, data.prescriptions];
        db.query(diagnosisQuery, diagnosisValues, (err) => {
            if (err) console.error('Error inserting diagnosis:', err);
        });

        // Handle optional fields
        const optionalFields = [
            { name: 'pastMedicalConditions', table: 'past_medical_conditions' },
            { name: 'surgicalHistory', table: 'surgical_history' },
            { name: 'allergies', table: 'allergies' },
            { name: 'currentMedications', table: 'current_medications' }
        ];

        optionalFields.forEach((field) => {
            if (data[field.name]) {
                const query = `INSERT INTO ${field.table} (personal_id, description) VALUES (?, ?)`;
                db.query(query, [personalId, data[field.name]], (err) => {
                    if (err) console.error(`Error inserting ${field.name}:`, err);
                });
            }
        });

        // Insert into upcoming_appointments table
        if (Array.isArray(data.upcomingAppointmentDates)) {
            const appointmentDatesQuery = `
                INSERT INTO upcoming_appointments (personal_id, appointment_date) VALUES ?
            `;
            const appointmentDatesValues = data.upcomingAppointmentDates.map((date) => [personalId, date]);
            db.query(appointmentDatesQuery, [appointmentDatesValues], (err) => {
                if (err) console.error('Error inserting upcoming appointment dates:', err);
            });
        }

        res.status(200).json({ message: 'Patient data submitted successfully!' });
    });
});


// Get all patients
app.get('/patients', (req, res) => {
    const query = `
        SELECT pd.*, ec.*, d.*
        FROM personal_details pd
        LEFT JOIN emergency_contact ec ON pd.id = ec.personal_id
        LEFT JOIN diagnosis d ON pd.id = d.personal_id
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving patient data:', err);
            return res.status(500).json({ message: 'Failed to retrieve patient data.' });
        }
        res.status(200).json(results);
    });
});

// Get patient by ID
app.get('/patients/:id', (req, res) => {
    const patientId = req.params.id;
    const query = `
        SELECT pd.*, ec.*, d.*
        FROM personal_details pd
        LEFT JOIN emergency_contact ec ON pd.id = ec.personal_id
        LEFT JOIN diagnosis d ON pd.id = d.personal_id
        WHERE pd.id = ?
    `;
    db.query(query, [patientId], (err, results) => {
        if (err) {
            console.error('Error retrieving patient data:', err);
            return res.status(500).json({ message: 'Failed to retrieve patient data.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Patient not found.' });
        }
        res.status(200).json(results[0]);
    });
});




// Search patient by ID and fetch all related data
app.get('/search_patient/:id', (req, res) => {
    const patientId = req.params.id;
    const query = `
        SELECT pd.*, ec.*, d.*, pmc.description AS past_medical_conditions, 
               sh.description AS surgical_history, a.description AS allergies, 
               cm.description AS current_medications, ua.appointment_date
        FROM personal_details pd
        LEFT JOIN emergency_contact ec ON pd.id = ec.personal_id
        LEFT JOIN diagnosis d ON pd.id = d.personal_id
        LEFT JOIN past_medical_conditions pmc ON pd.id = pmc.personal_id
        LEFT JOIN surgical_history sh ON pd.id = sh.personal_id
        LEFT JOIN allergies a ON pd.id = a.personal_id
        LEFT JOIN current_medications cm ON pd.id = cm.personal_id
        LEFT JOIN upcoming_appointments ua ON pd.id = ua.personal_id
        WHERE pd.id = ?
    `;

    db.query(query, [patientId], (err, results) => {
        if (err) {
            console.error('Error fetching patient data:', err);
            return res.status(500).json({ message: 'Failed to fetch patient data.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        // Group upcoming appointments in a separate array
        const appointments = results.map((row) => row.appointment_date).filter(Boolean);
        const patientData = { ...results[0], appointments };

        res.status(200).json(patientData);
    });
});


// Search patient by multiple details
app.get('/search_patient_by_details', (req, res) => {
    const { fullName, email, phoneNumber, gender, address } = req.query;

    // Build query dynamically based on provided filters
    const queryClauses = [];
    const queryParams = [];

    if (fullName) {
        queryClauses.push('pd.full_name LIKE ?');
        queryParams.push(`%${fullName}%`);
    }
    if (email) {
        queryClauses.push('pd.email = ?');
        queryParams.push(email);
    }
    if (phoneNumber) {
        queryClauses.push('pd.phone_number = ?');
        queryParams.push(phoneNumber);
    }
    if (gender) {
        queryClauses.push('pd.gender = ?');
        queryParams.push(gender);
    }
    if (address) {
        queryClauses.push('pd.address LIKE ?');
        queryParams.push(`%${address}%`);
    }

    if (queryClauses.length === 0) {
        return res.status(400).json({ message: 'Please provide at least one search parameter.' });
    }

    const query = `
        SELECT 
            pd.id, 
            pd.full_name, 
            pd.dob, 
            pd.address AS personal_address, 
            pd.phone_number AS personal_phone_number, 
            pd.email, 
            pd.gender, 
            ec.contact_name AS emergency_contact_name, 
            ec.relationship AS emergency_contact_relationship, 
            ec.phone_number AS emergency_contact_phone_number, 
            d.diagnoses, 
            d.treatment_plans, 
            d.prescriptions, 
            pmc.description AS past_medical_conditions, 
            sh.description AS surgical_history, 
            a.description AS allergies, 
            cm.description AS current_medications, 
            ua.appointment_date
        FROM personal_details pd
        LEFT JOIN emergency_contact ec ON pd.id = ec.personal_id
        LEFT JOIN diagnosis d ON pd.id = d.personal_id
        LEFT JOIN past_medical_conditions pmc ON pd.id = pmc.personal_id
        LEFT JOIN surgical_history sh ON pd.id = sh.personal_id
        LEFT JOIN allergies a ON pd.id = a.personal_id
        LEFT JOIN current_medications cm ON pd.id = cm.personal_id
        LEFT JOIN upcoming_appointments ua ON pd.id = ua.personal_id
        WHERE ${queryClauses.join(' AND ')}
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error searching for patient:', err);
            return res.status(500).json({ message: 'Failed to search for patient data.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'No patients found matching the given criteria.' });
        }

        // Group upcoming appointments in a separate array for each patient
        const patients = results.reduce((acc, row) => {
            const patient = acc[row.id] || {
                id: row.id,
                full_name: row.full_name,
                dob: row.dob,
                personal_address: row.personal_address,
                personal_phone_number: row.personal_phone_number,
                email: row.email,
                gender: row.gender,
                emergency_contact_name: row.emergency_contact_name,
                emergency_contact_relationship: row.emergency_contact_relationship,
                emergency_contact_phone_number: row.emergency_contact_phone_number,
                diagnoses: row.diagnoses,
                treatment_plans: row.treatment_plans,
                prescriptions: row.prescriptions,
                past_medical_conditions: row.past_medical_conditions,
                surgical_history: row.surgical_history,
                allergies: row.allergies,
                current_medications: row.current_medications,
                appointments: []
            };

            if (row.appointment_date) {
                patient.appointments.push(row.appointment_date);
            }

            acc[row.id] = patient;
            return acc;
        }, {});

        res.status(200).json(Object.values(patients));
    });
});

app.get('/appointments/upcoming', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const query = `
        SELECT ua.id, ua.appointment_date, pd.full_name, pd.dob, pd.address, pd.phone_number, pd.email, pd.gender, d.diagnoses
        FROM upcoming_appointments ua
        JOIN personal_details pd ON ua.personal_id = pd.id
        LEFT JOIN diagnosis d ON ua.personal_id = d.personal_id
        WHERE ua.appointment_date >= ?
        ORDER BY ua.appointment_date ASC
    `;
    db.query(query, [today], (err, results) => {
        if (err) {
            console.error('Error fetching upcoming appointments:', err);
            return res.status(500).json({ message: 'Failed to fetch upcoming appointments.' });
        }
        res.status(200).json(results);
    });
});


app.get('/appointments/missed', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const query = `
        SELECT ua.id, ua.appointment_date, pd.full_name, pd.dob, pd.address, pd.phone_number, pd.email, pd.gender, d.diagnoses
        FROM upcoming_appointments ua
        JOIN personal_details pd ON ua.personal_id = pd.id
        LEFT JOIN diagnosis d ON ua.personal_id = d.personal_id
        WHERE ua.appointment_date < ?
        ORDER BY ua.appointment_date ASC
    `;
    db.query(query, [today], (err, results) => {
        if (err) {
            console.error('Error fetching missed appointments:', err);
            return res.status(500).json({ message: 'Failed to fetch missed appointments.' });
        }
        res.status(200).json(results);
    });
});


app.post('/appointments/complete', (req, res) => {
    const { appointmentId, observations, doctorNotes } = req.body;

    const updateVisitQuery = `
        INSERT INTO DoctorVisits (patient_id, visit_date, observations, doctor_notes)
        SELECT personal_id, ?, ?, ?
        FROM upcoming_appointments
        WHERE id = ?
    `;
    const deleteAppointmentQuery = `DELETE FROM upcoming_appointments WHERE id = ?`;

    const today = new Date().toISOString().split('T')[0];

    db.query(updateVisitQuery, [today, observations, doctorNotes, appointmentId], (err) => {
        if (err) {
            console.error('Error updating visit:', err);
            return res.status(500).json({ message: 'Failed to complete appointment.' });
        }

        db.query(deleteAppointmentQuery, [appointmentId], (err) => {
            if (err) {
                console.error('Error deleting appointment:', err);
                return res.status(500).json({ message: 'Failed to delete completed appointment.' });
            }

            res.status(200).json({ message: 'Appointment completed successfully.' });
        });
    });
});

app.post('/appointments/reschedule', (req, res) => {
    const { appointmentId, newDate } = req.body;

    // Update the appointment date in the `upcoming_appointments` table
    const query = `UPDATE upcoming_appointments SET appointment_date = ? WHERE id = ?`;

    db.query(query, [newDate, appointmentId], (err, result) => {
        if (err) {
            console.error('Error rescheduling appointment:', err);
            return res.status(500).json({ message: 'Failed to reschedule appointment.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }
        res.status(200).json({ message: 'Appointment rescheduled successfully.' });
    });
});

const cors = require('cors');
app.use(cors());

// Route to get upcoming appointments for a specific patient by their ID and email
app.get('/appointments/upcoming/:patientId/:email', (req, res) => {
    const { patientId, email } = req.params;

    // Validate if the patient exists with the provided ID and email
    const query = `
        SELECT pd.id, ua.appointment_date
        FROM personal_details pd
        JOIN upcoming_appointments ua ON pd.id = ua.personal_id
        WHERE pd.id = ? AND pd.email = ? AND ua.appointment_date >= ?
        ORDER BY ua.appointment_date ASC
    `;

    const today = new Date().toISOString().split('T')[0];  // Get today's date in 'YYYY-MM-DD' format

    db.query(query, [patientId, email, today], (err, results) => {
        if (err) {
            console.error('Error fetching upcoming appointments:', err);
            return res.status(500).json({ message: 'Failed to fetch upcoming appointments.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No upcoming appointments found for the given details.' });
        }

        // Send back the list of upcoming appointments
        res.status(200).json(results);
    });
});

// Serve main.html at the /main route
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/main`);

    
});
