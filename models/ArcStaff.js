const mongoose = require('mongoose');

const ArcStaffSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  fullName: String,
  email: { type: String, required: true, unique: true },
  mobileNumber: String,
  alternateMobile: String,
  gender: String,
  dateOfBirth: Date,
  address: String,
  city: String,
  state: String,
  pincode: String,
  type: { type: String, default: 'arc_staff' },
  userType: { type: String, default: 'arc_staff' }, // arc_staff, super_admin
  role: String, // arc_staff, supervisor, manager, super_admin
  status: { type: String, default: 'active' }, // active, inactive, suspended
  isApproved: { type: Boolean, default: true },
  approvalStatus: { type: String, default: 'approved' }, // pending, approved, rejected
  approvedBy: String,
  approvedAt: Date,
  rejectedBy: String,
  rejectedAt: Date,
  rejectionReason: String,
  registrationDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  
  // Staff Specific Information
  staffId: { type: String, unique: true },
  department: String,
  designation: String,
  joiningDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  // Permissions
  canApproveHospitals: { type: Boolean, default: false },
  canApproveDoctors: { type: Boolean, default: false },
  canApproveLabs: { type: Boolean, default: false },
  canApprovePharmacies: { type: Boolean, default: false },
  canApproveNurses: { type: Boolean, default: false },
  canViewReports: { type: Boolean, default: false },
  canManageUsers: { type: Boolean, default: false },
  
  // Created by admin
  createdBy: String, // Admin UID
  
  // Profile completion status
  profileComplete: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

// Add static method to find staff by UID
ArcStaffSchema.statics.findByUid = function(uid) {
  return this.findOne({ uid });
};

// Add method to get public profile
ArcStaffSchema.methods.getPublicProfile = function() {
  const staffObject = this.toObject();
  delete staffObject.__v;
  return staffObject;
};

// Method to check if staff can approve specific type
ArcStaffSchema.methods.canApprove = function(userType) {
  const permissionMap = {
    'hospital': 'canApproveHospitals',
    'doctor': 'canApproveDoctors',
    'lab': 'canApproveLabs',
    'pharmacy': 'canApprovePharmacies',
    'nurse': 'canApproveNurses',
  };
  
  const permission = permissionMap[userType.toLowerCase()];
  return permission ? this[permission] : false;
};

// Method to check if user is super admin
ArcStaffSchema.methods.isSuperAdmin = function() {
  return this.userType === 'super_admin' && this.role === 'super_admin';
};

// Generate staff ID before saving
ArcStaffSchema.pre('save', async function(next) {
  if (this.isNew && !this.staffId) {
    const count = await this.constructor.countDocuments();
    this.staffId = `ARC${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const ArcStaff = mongoose.model('ArcStaff', ArcStaffSchema);

module.exports = ArcStaff; 