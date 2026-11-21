import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { DBState, User, Drug, Booking, SystemLog } from './src/types.js';
import { db as firestoreDB } from './src/lib/firebase.js';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'rxnexus_db.json');

// Helper to load database state
function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded && loaded.users && Array.isArray(loaded.users)) {
        loaded.users.forEach((u: any) => {
          if (!u.roles || !Array.isArray(u.roles)) {
            u.roles = [u.role || 'Nurse'];
          }
        });
      }
      return loaded;
    }
  } catch (error) {
    console.error('Error reading database file, using fallback state:', error);
  }

  // Fallback initial database state
  const initialUsers: User[] = [
    {
      id: '585982',
      username: '585982',
      name: 'Preeyapat Pongvikrant',
      role: 'Admin',
      roles: ['Admin'],
      password: '25031998'
    },
    {
      id: 'ph-1',
      username: 'pharmacist1',
      name: 'Dr. Sarah Smith',
      role: 'Pharmacist',
      roles: ['Pharmacist'],
      password: 'password123'
    },
    {
      id: 'pha-1',
      username: 'assistant1',
      name: 'Jack Daniels',
      role: 'Pharmacist Assistant',
      roles: ['Pharmacist Assistant'],
      password: 'password123'
    },
    {
      id: 'nurse-1',
      username: 'nurse1',
      name: 'Nurse Clara Barton',
      role: 'Nurse',
      roles: ['Nurse'],
      password: 'password123'
    },
    {
      id: 'dr-1',
      username: 'doctor1',
      name: 'Dr. Gregory House',
      role: 'Doctor',
      roles: ['Doctor'],
      password: 'password123'
    },
    {
      id: 'clerk-1',
      username: 'clerk1',
      name: 'Somsak Warehouse',
      role: 'Pharmacy Stock Clerk',
      roles: ['Pharmacy Stock Clerk'],
      password: 'password123'
    }
  ];

   const initialDrugs: Drug[] = [];
 
   const initialBookings: Booking[] = [];

  const initialLogs: SystemLog[] = [
    {
      id: 'log-1',
      timestamp: '2026-05-20T12:00:00Z',
      userId: '585982',
      userName: 'Preeyapat Pongvikrant',
      userRole: 'Admin',
      action: 'System Initialized',
      details: 'RxNexus medication booking database initialized successfully.'
    }
  ];

  const newState: DBState = {
    users: initialUsers,
    drugs: initialDrugs,
    bookings: initialBookings,
    logs: initialLogs
  };

  saveDB(newState);
  return newState;
}

// Helper to save database state
function saveDB(state: DBState) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

async function migrateIfNeeded() {
  try {
    const colRef = collection(firestoreDB, 'users');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('[Migration] Firestore is empty. Seeding database with initial data from local JSON.');
      const localDB = loadDB(); // loads from rxnexus_db.json or fallback state
      
      // Save all users
      for (const u of localDB.users) {
        await setDoc(doc(firestoreDB, 'users', u.id), u);
      }
      // Save all drugs
      for (const d of localDB.drugs) {
        await setDoc(doc(firestoreDB, 'drugs', d.id), d);
      }
      // Save all bookings
      for (const b of localDB.bookings) {
        await setDoc(doc(firestoreDB, 'bookings', b.id), b);
      }
      // Save all logs
      for (const l of localDB.logs) {
        await setDoc(doc(firestoreDB, 'logs', l.id), l);
      }
      console.log('[Migration] Database seeding completed successfully.');
    } else {
      console.log('[Migration] Database holds existing data inside Cloud Firestore. Bypassing seeding.');
    }
  } catch (error) {
    console.error('[Migration] Error seeding database:', error);
  }
}

async function startServer() {
  const app = express();
  
  // Trigger automated seeding and schema migration to Firebase Firestore
  await migrateIfNeeded();

  // Allow larger payloads (for base64 uploaded prescriptions)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Get current DB state
  const db = loadDB();

  // API - Auth - Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.users.find(
      (u) => u.username === username.trim() && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    // Return the user (excluding password)
    const { password: _, ...userSafe } = user;

    // Log the login incident
    const logId = 'log-' + Date.now();
    db.logs.unshift({
      id: logId,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'User Login',
      details: `User logged in from department workspace.`
    });
    saveDB(db);

    res.json({ user: userSafe });
  });

  // API - Users (Full CRUD for Admin)
  app.get('/api/users', (req, res) => {
    const usersSafe = db.users.map(({ password, ...raw }) => raw);
    res.json(usersSafe);
  });

  app.post('/api/users', (req, res) => {
    const { username, name, role, roles, password, actorId } = req.body;
    if (!username || !name || (!role && (!roles || roles.length === 0)) || !password) {
      return res.status(400).json({ error: 'Missing mandatory fields' });
    }

    // Prevent duplicates
    const exist = db.users.find((u) => u.username === username);
    if (exist) {
      return res.status(400).json({ error: 'User ID / Username already exists' });
    }

    const finalRoles = roles || [role];
    const finalRole = role || finalRoles[0] || 'Nurse';

    const newUser: User = {
      id: 'usr-' + Date.now(),
      username: username.trim(),
      name: name.trim(),
      role: finalRole,
      roles: finalRoles,
      password
    };

    db.users.push(newUser);

    // Logs
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrator',
      userRole: actor?.role || 'Admin',
      action: 'Create Staff',
      details: `Created new user staff: ${name} with roles ${finalRoles.join(', ')}.`
    });

    saveDB(db);
    const { password: _, ...newUserSafe } = newUser;
    res.status(210).json(newUserSafe);
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, role, roles, password, actorId } = req.body;

    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (roles && Array.isArray(roles) && roles.length > 0) {
      user.roles = roles;
      user.role = roles[0]; // sync primary role
    } else if (role) {
      user.role = role;
      user.roles = [role];
    }
    if (password) user.password = password;

    // Logs
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrator',
      userRole: actor?.role || 'Admin',
      action: 'Update Staff',
      details: `Updated information for staff: ${user.name} (${user.username}).`
    });

    saveDB(db);
    const { password: _, ...userSafe } = user;
    res.json(userSafe);
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { actorId } = req.body;

    if (id === '585982') {
      return res.status(400).json({ error: 'Cannot remove default system Administrator!' });
    }

    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = db.users[index];
    db.users.splice(index, 1);

    // Logs
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrator',
      userRole: actor?.role || 'Admin',
      action: 'Delete Staff',
      details: `Deleted user staff: ${deletedUser.name} (${deletedUser.role}).`
    });

    saveDB(db);
    res.json({ success: true, deleted: deletedUser.name });
  });

  // API - Drugs (CRUD for Pharmacists / Admin)
  app.get('/api/drugs', (req, res) => {
    res.json(db.drugs);
  });

  app.post('/api/drugs', (req, res) => {
    const { name, type, stockCode, prices, actorId } = req.body;
    if (!name || !type || !stockCode || !prices) {
      return res.status(400).json({ error: 'Missing mandatory fields' });
    }

    // Check duplicate stockCode
    const exists = db.drugs.find((d) => d.stockCode === stockCode);
    if (exists) {
      return res.status(400).json({ error: 'Stock code already exists in catalog.' });
    }

    const newDrug: Drug = {
      id: 'drg-' + Date.now(),
      name: name.trim(),
      type,
      stockCode: stockCode.toUpperCase().trim(),
      prices: {
        employee: Number(prices.employee) || 0,
        opd: Number(prices.opd) || 0,
        ipd: Number(prices.ipd) || 0,
        it: Number(prices.it) || 0
      }
    };

    db.drugs.push(newDrug);

    // Log action
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Pharmacist',
      userRole: actor?.role || 'Pharmacist',
      action: 'Register Drug',
      details: `Added new ${type} pharmaceutical medicine: ${name} (Stock Code: ${stockCode}).`
    });

    saveDB(db);
    res.status(201).json(newDrug);
  });

  app.put('/api/drugs/:id', (req, res) => {
    const { id } = req.params;
    const { name, stockCode, prices, actorId } = req.body;

    const drug = db.drugs.find((d) => d.id === id);
    if (!drug) {
      return res.status(404).json({ error: 'Drug not found' });
    }

    if (name) drug.name = name.trim();
    if (stockCode) drug.stockCode = stockCode.toUpperCase().trim();
    if (prices) {
      drug.prices = {
        employee: Number(prices.employee) ?? drug.prices.employee,
        opd: Number(prices.opd) ?? drug.prices.opd,
        ipd: Number(prices.ipd) ?? drug.prices.ipd,
        it: Number(prices.it) ?? drug.prices.it
      };
    }

    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Pharmacist',
      userRole: actor?.role || 'Pharmacist',
      action: 'Update Drug',
      details: `Updated drug item: ${drug.name} updates.`
    });

    saveDB(db);
    res.json(drug);
  });

  app.delete('/api/drugs/:id', (req, res) => {
    const { id } = req.params;
    const { actorId } = req.body;

    const index = db.drugs.findIndex((d) => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Drug not found' });
    }

    const deletedDrug = db.drugs[index];
    db.drugs.splice(index, 1);

    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Pharmacist',
      userRole: actor?.role || 'Pharmacist',
      action: 'Remove Drug',
      details: `Removed drug from catalog: ${deletedDrug.name}.`
    });

    saveDB(db);
    res.json({ success: true });
  });

  // API - Bookings CRUD
  app.get('/api/bookings', (req, res) => {
    res.json(db.bookings);
  });

  app.post('/api/bookings', (req, res) => {
    const {
      bookingDate,
      hn,
      patientName,
      dateOfUse,
      department,
      mode,
      medications,
      totalAmount,
      prescriptionImage,
      staff,
      actorId
    } = req.body;

    if (!hn || !patientName || !dateOfUse || !staff?.doctor || !staff?.nurse) {
      return res.status(400).json({ error: 'Zero Data Loss Protocol: Mandatory patient and provider credentials required!' });
    }

    // ID Format e.g., RXN-YYYYMMDD-COUNT
    const todayStr = bookingDate.replace(/-/g, '');
    const todaysBookingCount = db.bookings.filter(b => b.bookingDate === bookingDate).length + 1;
    const bookingId = `RXN-${todayStr}-${String(todaysBookingCount).padStart(3, '0')}`;

    const newBooking: Booking = {
      id: bookingId,
      bookingDate,
      hn,
      patientName,
      dateOfUse,
      department: department || 'General Outpatient',
      mode,
      medications: medications || [],
      totalAmount: Number(totalAmount) || 0,
      prescriptionImage: prescriptionImage || '',
      staff: {
        doctor: staff.doctor,
        nurse: staff.nurse,
        pharmacist: staff.pharmacist || '',
        creatorId: actorId,
        creatorName: staff.creatorName || 'Staff Member'
      },
      pharmacistVerification: {
        status: 'Pending',
        verifiedBy: '',
        verifiedAt: ''
      },
      clerkVerification: {
        status: 'Pending',
        verifiedBy: '',
        verifiedAt: ''
      },
      createdAt: new Date().toISOString()
    };

    db.bookings.unshift(newBooking);

    // Logs
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Staff',
      userRole: actor?.role || 'Nurse',
      action: 'Create Booking',
      details: `Created reservation ${bookingId} for patient ${patientName} (${hn}) using ${mode} drugs.`
    });

    saveDB(db);
    res.status(201).json(newBooking);
  });

  app.put('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const {
      hn,
      patientName,
      dateOfUse,
      department,
      medications,
      totalAmount,
      prescriptionImage,
      staff,
      actorId
    } = req.body;

    const booking = db.bookings.find((b) => b.id === id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking reservation not found' });
    }

    if (hn) booking.hn = hn;
    if (patientName) booking.patientName = patientName;
    if (dateOfUse) booking.dateOfUse = dateOfUse;
    if (department) booking.department = department;
    if (medications) booking.medications = medications;
    if (totalAmount !== undefined) booking.totalAmount = totalAmount;
    if (prescriptionImage !== undefined) booking.prescriptionImage = prescriptionImage;
    if (staff) {
      booking.staff = {
        ...booking.staff,
        doctor: staff.doctor || booking.staff.doctor,
        nurse: staff.nurse || booking.staff.nurse,
        pharmacist: staff.pharmacist || booking.staff.pharmacist
      };
    }

    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Staff',
      userRole: actor?.role || 'Nurse',
      action: 'Update Booking',
      details: `Edited reservation ${id} for patient ${booking.patientName}.`
    });

    saveDB(db);
    res.json(booking);
  });

  app.delete('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const { actorId } = req.body;

    const index = db.bookings.findIndex((b) => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Booking reservation not found' });
    }

    const deleted = db.bookings[index];
    db.bookings.splice(index, 1);

    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Staff',
      userRole: actor?.role || 'Admin',
      action: 'Delete Booking',
      details: `Deleted booking record ${id} of ${deleted.patientName}.`
    });

    saveDB(db);
    res.json({ success: true });
  });

  // Pharmacist Order Verification Accepted action
  app.post('/api/bookings/:id/verify-pharmacist', (req, res) => {
    const { id } = req.params;
    const { verifiedBy, actorId } = req.body;

    const booking = db.bookings.find((b) => b.id === id);
    if (!booking) {
      return res.status(404).json({ error: 'Medication reservation not found' });
    }

    booking.pharmacistVerification = {
      status: 'Verified',
      verifiedBy: verifiedBy || 'Pharmacist Coordinator',
      verifiedAt: new Date().toISOString()
    };

    // Auto update status structure if they match
    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'system',
      userName: actor?.name || 'Pharmacist',
      userRole: actor?.role || 'Pharmacist',
      action: 'Verify Ordered Medication',
      details: `Approved verification of drug allocation for ${booking.id} (${booking.patientName}).`
    });

    saveDB(db);
    res.json(booking);
  });

  // Clerk Order Verification Accepted action (once drug physically arrives to update tracking status)
  app.post('/api/bookings/:id/verify-clerk', (req, res) => {
    const { id } = req.params;
    const { verifiedBy, actorId } = req.body;

    const booking = db.bookings.find((b) => b.id === id);
    if (!booking) {
      return res.status(404).json({ error: 'Medication reservation not found' });
    }

    booking.clerkVerification = {
      status: 'Ready-to-use',
      verifiedBy: verifiedBy || 'Pharmacy Stock Clerk',
      verifiedAt: new Date().toISOString()
    };

    const actor = db.users.find(u => u.id === actorId);
    db.logs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actor?.id || 'warehouse',
      userName: actor?.name || 'Warehouse Staff',
      userRole: actor?.role || 'Pharmacy Stock Clerk',
      action: 'Stock Delivered',
      details: `Marked pharmacy supply as physically delivered & fully available for Patient ${booking.patientName} (${booking.id}).`
    });

    saveDB(db);
    res.json(booking);
  });

  // API - System Logs (Admin Traceability Audit)
  app.get('/api/logs', (req, res) => {
    res.json(db.logs);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RxNexus Server] running on http://localhost:${PORT}`);
  });
}

startServer();
