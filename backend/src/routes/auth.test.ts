import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User, UserRole } from '../models/User.js';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy_auth_test';

const app = createApp();

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Phase 3: Authentication & Role-Based Authorization API Suite', () => {
  let adminToken: string;
  let adminUser: any;
  let pharmacistToken: string;
  let pharmacistUser: any;
  let customerToken: string;
  let customerUser: any;

  describe('POST /api/auth/register', () => {
    it('should register a new customer account successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'New Customer',
        email: 'newcustomer@pharmacare.test',
        password: 'Password@123',
        phone: '+91 98765 00001',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('newcustomer@pharmacare.test');
      expect(res.body.user.role).toBe(UserRole.CUSTOMER);

      customerToken = res.body.token;
      customerUser = res.body.user;
    });

    it('should reject registration when email is already in use', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate Attempt',
        email: 'newcustomer@pharmacare.test',
        password: 'Password@123',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Invalid Email User',
        email: 'not-an-email-address',
        password: 'Password@123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject registration with password shorter than 6 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Short Pass User',
        email: 'shortpass@pharmacare.test',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should prevent unauthenticated users from self-registering as ADMIN', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Malicious Admin Wannabe',
        email: 'wannabe@pharmacare.test',
        password: 'Password@123',
        role: UserRole.ADMIN,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Administrator');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create seed users for auth tests directly
      adminUser = await User.create({
        name: 'Test Admin',
        email: 'admin@auth.test',
        password: 'AdminPassword@123',
        role: UserRole.ADMIN,
      });

      pharmacistUser = await User.create({
        name: 'Test Pharmacist',
        email: 'pharmacist@auth.test',
        password: 'StaffPassword@123',
        role: UserRole.PHARMACIST,
      });
    });

    it('should log in admin with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@auth.test',
        password: 'AdminPassword@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe(UserRole.ADMIN);

      adminToken = res.body.token;
    });

    it('should log in pharmacist with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'pharmacist@auth.test',
        password: 'StaffPassword@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe(UserRole.PHARMACIST);

      pharmacistToken = res.body.token;
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@auth.test',
        password: 'IncorrectPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@auth.test',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject login for deactivated user', async () => {
      const deactivatedUser = await User.create({
        name: 'Deactivated Staff',
        email: 'deactivated@auth.test',
        password: 'Password@123',
        role: UserRole.PHARMACIST,
        isActive: false,
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'deactivated@auth.test',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('admin@auth.test');
      expect(res.body.user.role).toBe(UserRole.ADMIN);
    });

    it('should reject request when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request when token is malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.corrupted.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update name and phone number', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Updated Admin',
          phone: '+91 99999 11111',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('Dr. Updated Admin');
      expect(res.body.user.phone).toBe('+91 99999 11111');
    });

    it('should change password when correct currentPassword is provided', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'AdminPassword@123',
          newPassword: 'BrandNewAdminPassword@456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login works with new password
      const loginCheck = await request(app).post('/api/auth/login').send({
        email: 'admin@auth.test',
        password: 'BrandNewAdminPassword@456',
      });
      expect(loginCheck.status).toBe(200);

      // Refresh admin token for subsequent tests
      adminToken = loginCheck.body.token;
    });

    it('should reject password update when current password is wrong', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'WrongPasswordGiven',
          newPassword: 'AnotherPassword@789',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Current password');
    });
  });

  describe('Role-Based Access Control (RBAC) on /api/users', () => {
    it('should grant access to ADMIN on /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should deny access (403 Forbidden) to PHARMACIST on /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should deny access (403 Forbidden) to CUSTOMER on /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should allow ADMIN to deactivate a staff account', async () => {
      const res = await request(app)
        .patch(`/api/users/${pharmacistUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);

      // Verify the deactivated pharmacist token is rejected on authenticated routes
      const checkRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(checkRes.status).toBe(401);
      expect(checkRes.body.message).toContain('deactivated');
    });

    it('should prevent ADMIN from deactivating their own account', async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot deactivate their own');
    });
  });
});
