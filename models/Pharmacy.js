const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  // Basic Information
  uid: {
    type: String,
    required: true,
    unique: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  pharmacyName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  alternateMobile: {
    type: String,
    required: false,
    trim: true
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  pharmacistName: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    default: 'pharmacy'
  },
  
  // License Information
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  licenseDocumentUrl: {
    type: String,
    required: true
  },
  drugLicenseUrl: {
    type: String,
    required: false
  },
  premisesCertificateUrl: {
    type: String,
    required: false
  },
  
  // Business Information
  servicesProvided: [{
    type: String,
    trim: true
  }],
  drugsAvailable: [{
    type: String,
    trim: true
  }],
  homeDelivery: {
    type: Boolean,
    default: false
  },
  operatingHours: {
    openTime: {
      type: String,
      required: false,
      trim: true
    },
    closeTime: {
      type: String,
      required: false,
      trim: true
    },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: false
    }]
  },
  
  // Pharmacist Professional Information
  pharmacistLicenseNumber: {
    type: String,
    required: false,
    trim: true
  },
  pharmacistQualification: {
    type: String,
    required: false,
    trim: true
  },
  pharmacistExperienceYears: {
    type: Number,
    required: false,
    min: 0
  },
  
  // Hospital Affiliations
  affiliatedHospitals: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String, required: true },
    role: { type: String, enum: ['Primary', 'Secondary', 'Partner', 'Emergency', 'Contract'], default: 'Partner' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: false },
    isActive: { type: Boolean, default: true }
  }],
  pharmacyAffiliatedHospitals: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String, required: true },
    role: { type: String, enum: ['Primary', 'Secondary', 'Partner', 'Emergency', 'Contract'], default: 'Partner' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: false },
    isActive: { type: Boolean, default: true }
  }],
  
  // Medicine Inventory
  medicineInventory: [{
    medicineId: {
      type: String,
      required: true
    },
    medicineName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      trim: true
    },
    requiresPrescription: {
      type: Boolean,
      default: false
    },
    inStock: {
      type: Boolean,
      default: true
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviews: {
      type: Number,
      default: 0,
      min: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Address Information
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  geoCoordinates: { lat: Number, lng: Number },
  longitude: { type: Number, required: false },
  latitude: { type: Number, required: false },
  
  // Profile and System
  profileImageUrl: {
    type: String,
    required: false,
    default: ''
  },
  
  // Documents
  documents: {
    pharmacy_license: { type: String },
    drug_license: { type: String },
    premises_certificate: { type: String }
  },
  
  // Registration
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  // Approval Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: String,
    ref: 'ArcStaff'
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String
  },
  rejectedBy: {
    type: String,
    ref: 'ArcStaff'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  
  // System Fields
  arcId: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCode: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to generate arcId and update timestamp
pharmacySchema.pre('save', function(next) {
  if (!this.arcId) {
    this.arcId = 'PHA' + Date.now().toString().slice(-8);
  }
  this.updatedAt = new Date();
  next();
});

// Static methods
pharmacySchema.statics.findByCity = function(city) {
  return this.find({ city: new RegExp(city, 'i'), isApproved: true });
};

pharmacySchema.statics.findByDrug = function(drugName) {
  return this.find({ 
    drugsAvailable: { $in: [new RegExp(drugName, 'i')] },
    isApproved: true 
  });
};

pharmacySchema.statics.getPendingApprovals = function() {
  return this.find({ approvalStatus: 'pending' });
};

pharmacySchema.statics.approvePharmacy = function(pharmacyId, approvedBy, notes = '') {
  return this.findByIdAndUpdate(pharmacyId, {
    isApproved: true,
    approvalStatus: 'approved',
    approvedBy,
    approvedAt: new Date(),
    approvalNotes: notes
  });
};

pharmacySchema.statics.rejectPharmacy = function(pharmacyId, rejectedBy, reason = '') {
  return this.findByIdAndUpdate(pharmacyId, {
    isApproved: false,
    approvalStatus: 'rejected',
    rejectedBy,
    rejectedAt: new Date(),
    rejectionReason: reason
  });
};

// Medicine inventory management methods
pharmacySchema.statics.addMedicine = function(pharmacyId, medicineData) {
  return this.findByIdAndUpdate(
    pharmacyId,
    { $push: { medicineInventory: medicineData } },
    { new: true }
  );
};

pharmacySchema.statics.updateMedicine = function(pharmacyId, medicineId, updateData) {
  return this.findOneAndUpdate(
    { _id: pharmacyId, 'medicineInventory.medicineId': medicineId },
    { 
      $set: { 
        'medicineInventory.$.updatedAt': new Date(),
        ...Object.keys(updateData).reduce((acc, key) => {
          acc[`medicineInventory.$.${key}`] = updateData[key];
          return acc;
        }, {})
      }
    },
    { new: true }
  );
};

pharmacySchema.statics.removeMedicine = function(pharmacyId, medicineId) {
  return this.findByIdAndUpdate(
    pharmacyId,
    { $pull: { medicineInventory: { medicineId } } },
    { new: true }
  );
};

pharmacySchema.statics.getMedicineInventory = function(pharmacyId) {
  return this.findById(pharmacyId).select('medicineInventory pharmacyName city state');
};

pharmacySchema.statics.searchMedicines = function(searchQuery, city = null) {
  const query = {
    isApproved: true,
    'medicineInventory': { $exists: true, $ne: [] }
  };
  
  if (city) {
    query.city = new RegExp(city, 'i');
  }
  
  if (searchQuery) {
    query.$or = [
      { 'medicineInventory.medicineName': new RegExp(searchQuery, 'i') },
      { 'medicineInventory.category': new RegExp(searchQuery, 'i') }
    ];
  }
  
  return this.find(query).select('pharmacyName city state address medicineInventory');
};

module.exports = mongoose.model('Pharmacy', pharmacySchema); 