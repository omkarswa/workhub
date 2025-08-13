const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Warning = require('../models/Warning');
const Employee = require('../models/Employee');
const User = require('../models/User');

// Test data
let adminToken;
let hrToken;
let managerToken;
let employeeToken;
let testEmployee;
let testWarning;

describe('Warning and Termination Workflow', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create test users with different roles
    const adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      roles: ['admin']
    });

    const hrUser = await User.create({
      email: 'hr@test.com',
      password: 'password123',
      firstName: 'HR',
      lastName: 'User',
      roles: ['hr']
    });

    const managerUser = await User.create({
      email: 'manager@test.com',
      password: 'password123',
      firstName: 'Manager',
      lastName: 'User',
      roles: ['manager']
    });

    const employeeUser = await User.create({
      email: 'employee@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Employee',
      roles: ['employee']
    });

    // Create test employee
    testEmployee = await Employee.create({
      user: employeeUser._id,
      employeeId: 'EMP001',
      department: 'IT',
      designation: 'Software Developer',
      joiningDate: new Date('2023-01-01'),
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phoneNumber: '1234567890',
      createdBy: adminUser._id
    });

    // Login to get tokens
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    adminToken = adminRes.body.token;

    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'hr@test.com',
        password: 'password123'
      });
    hrToken = hrRes.body.token;

    const managerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager@test.com',
        password: 'password123'
      });
    managerToken = managerRes.body.token;

    const employeeRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@test.com',
        password: 'password123'
      });
    employeeToken = employeeRes.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Warning.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Warning Creation', () => {
    it('should create a new warning (Admin)', async () => {
      const warningData = {
        employee: testEmployee._id,
        type: 'Tardiness',
        title: 'Frequent Late Arrival',
        description: 'Employee has been late 3 times this week.',
        severity: 'medium',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      const res = await request(app)
        .post('/api/v1/warnings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(warningData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('active');
      
      // Save for later tests
      testWarning = res.body.data;
    });

    it('should create a new warning (HR)', async () => {
      const warningData = {
        employee: testEmployee._id,
        type: 'Performance',
        title: 'Low Performance',
        description: 'Consistently missing deadlines.',
        severity: 'high',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      const res = await request(app)
        .post('/api/v1/warnings')
        .set('Authorization', `Bearer ${hrToken}`)
        .send(warningData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
    });

    it('should not allow employee to create a warning', async () => {
      const warningData = {
        employee: testEmployee._id,
        type: 'Test',
        title: 'Unauthorized Warning',
        description: 'This should fail.',
        severity: 'low',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      const res = await request(app)
        .post('/api/v1/warnings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(warningData);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('Warning Management', () => {
    it('should get all warnings (Admin)', async () => {
      const res = await request(app)
        .get('/api/v1/warnings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('should get a specific warning', async () => {
      const res = await request(app)
        .get(`/api/v1/warnings/${testWarning._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testWarning._id);
    });

    it('should update a warning (HR)', async () => {
      const updates = {
        description: 'Updated description',
        severity: 'high'
      };

      const res = await request(app)
        .put(`/api/v1/warnings/${testWarning._id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send(updates);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe(updates.description);
      expect(res.body.data.severity).toBe(updates.severity);
    });

    it('should resolve a warning (Manager)', async () => {
      const res = await request(app)
        .put(`/api/v1/warnings/${testWarning._id}/resolve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'Issue has been addressed.' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
    });

    it('should escalate a warning (Manager)', async () => {
      // First, create a new warning to escalate
      const warning = await Warning.create({
        employee: testEmployee._id,
        type: 'Behavior',
        title: 'Inappropriate Behavior',
        description: 'Reported by team members.',
        severity: 'high',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: new mongoose.Types.ObjectId() // Random ID for test
      });

      const res = await request(app)
        .put(`/api/v1/warnings/${warning._id}/escalate`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'Needs HR attention.' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.escalated).toBe(true);
    });

    it('should withdraw a warning (Admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/warnings/${testWarning._id}/withdraw`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'False alarm' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('withdrawn');
    });
  });

  describe('Employee Termination', () => {
    it('should terminate an employee (Admin)', async () => {
      const terminationData = {
        terminationDate: new Date(),
        lastWorkingDay: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks notice
        reason: 'Violation of company policies',
        notes: 'After multiple warnings, termination is necessary.'
      };

      const res = await request(app)
        .put(`/api/v1/employees/${testEmployee._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'terminated',
          effectiveDate: new Date(),
          ...terminationData
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('terminated');
    });

    it('should not allow non-admin/HR to terminate', async () => {
      const res = await request(app)
        .put(`/api/v1/employees/${testEmployee._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'terminated',
          effectiveDate: new Date(),
          reason: 'Test termination',
          notes: 'This should fail'
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('Employee Warnings', () => {
    it('should get all warnings for an employee', async () => {
      const res = await request(app)
        .get(`/api/v1/warnings/employee/${testEmployee._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
    });

    it('should get active warnings', async () => {
      const res = await request(app)
        .get('/api/v1/warnings/active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBeTruthy();
    });
  });
});
