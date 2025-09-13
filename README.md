# Edukaster Backend

## Admin User Setup

### Creating an Admin User

To create an admin user, run the following command:

```bash
npm run create-admin
```

This will create an admin user with the following credentials:

- **Email**: `admin@edukaster.com`
- **Password**: `Admin123!`

**Important**: Change the password after first login for security.

### Manual Admin Creation

You can also create an admin user manually using MongoDB:

```javascript
// Connect to your MongoDB database
use edukaster

// Insert admin user
db.users.insertOne({
  email: "admin@edukaster.com",
  password: "$2a$10$...", // Use bcrypt to hash the password
  name: "System Administrator",
  role: "admin",
  isApproved: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### Admin Login Process

1. Start the backend server: `npm run server:dev`
2. Open the mobile app
3. Navigate to the authentication screen
4. Click "Admin Login" at the bottom
5. Enter admin credentials:
   - Email: `admin@edukaster.com`
   - Password: `Admin123!`
6. You'll be redirected to the admin dashboard

### Admin Features

The admin user has access to:

- User management (approve tutors, suspend users)
- Content moderation (approve questions, review uploads)
- Payment management (confirm bookings, release payments)
- Dispute resolution (investigate and resolve disputes)
- Platform analytics and reports

### Security Notes

- Always use strong passwords for admin accounts
- Consider implementing 2FA for admin accounts in production
- Regularly audit admin activities
- Use environment variables for sensitive configuration
