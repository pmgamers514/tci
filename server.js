import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tci_ultra_secret_key_123';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pmgamers514_db_user:tufPRE9tfOUGM0uC@cluster0.vw6cfsc.mongodb.net/?appName=Cluster0';

// --- Database Connection and Seeding ---
const initializeDatabase = async () => {
  try {
    console.log(`[DATABASE] Attempting to connect to MongoDB Atlas...`);
    
    // Connect with options to handle Atlas connections better
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 60000,
    });
    
    const dbName = mongoose.connection.name;
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('---------------------------------------------------------');
    console.log('✅ SUCCESS: Connected to MongoDB Atlas');
    console.log(`📡 Database: ${dbName}`);
    console.log(`📂 Collections: ${collections.map(c => c.name).join(', ')}`);
    console.log(`🚀 Mode: Persistent Production Storage`);
    console.log('---------------------------------------------------------');
    
    await seedAdmin();
    await seedCourses();
    await seedFinalExam();
    await seedCertificateConfig();
  } catch (err) {
    console.error('---------------------------------------------------------');
    console.error('❌ CRITICAL: MongoDB Atlas connection failed.');
    console.error(`Error details: ${err.message}`);
    console.error('The application requires a database connection to function.');
    console.error('Please verify your MONGODB_URI and IP Whitelist in Atlas.');
    console.error('---------------------------------------------------------');
    // In production, we might want to exit, but in dev we let the server stay up 
    // so the user can fix the environment variable.
  }
};

// --- Schemas ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: String,
  address: String,
  profileImage: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isPaid: { type: Boolean, default: false },
  plan: { type: String, enum: ['General', 'Legal', 'Combo', 'General Transcription', 'Legal Transcription', 'Combo (General+Legal)'], default: 'General Transcription' },
  studentId: { type: String, default: () => `TCI-${Math.floor(10000 + Math.random() * 90000)}` },
  joinedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
  quizResults: [{
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    score: Number,
    date: { type: String, default: () => new Date().toISOString() }
  }]
});

const EnrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userEmail: String,
  courseTitle: String,
  status: { type: String, enum: ['partial', 'completed'] },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  amount: { type: Number, default: 0 }
});

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  image: String, // Base64 or URL
  attachmentUrl: String,
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'draft', 'disabled'], default: 'draft' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const LessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  slug: String,
  chapterTitle: String,
  keywords: String,
  canonicalUrl: String,
  description: String,
  videoUrl: String,
  audioUrl: String,
  content: String,
  attachmentUrl: String,
  duration: String,
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  order: { type: Number, default: 0 },
  transcriptionAudioUrl: String,
  transcriptionCorrectText: String,
  preventMultipleAttempts: { type: Boolean, default: false },
  questions: [{
    question: { type: String },
    options: [String],
    correctAnswer: { type: Number }
  }]
});

const QuizSchema = new mongoose.Schema({
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  title: { type: String, required: true },
  passingCriteria: { type: Number, default: 70 },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  questions: [{
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: Number, required: true }
  }]
});

const FinalExamSchema = new mongoose.Schema({
  title: { type: String, default: 'TCI Final Certification Exam' },
  mcqs: [{ question: String, options: [String], correctAnswer: Number }],
  transcriptionAudioUrl: String,
  transcriptionCorrectText: String
});

const ResultSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userEmail: String,
  examTitle: String,
  mcqScore: Number,
  transcriptionScore: Number,
  totalScore: Number,
  answers: [{
    question: String,
    selectedOption: Number,
    correctOption: Number,
    isCorrect: Boolean
  }],
  feedback: String,
  date: { type: String, default: () => new Date().toISOString() }
});

const FinalExamSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userEmail: String,
  submissionFile: String, // Base64
  submissionFileName: String,
  submissionFileType: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminRemarks: String,
  score: Number,
  submittedAt: { type: String, default: () => new Date().toISOString() },
  reviewedAt: String,
  certificateUrl: String
});

const User = mongoose.model('User', UserSchema);
const Enrollment = mongoose.model('Enrollment', EnrollmentSchema);
const Course = mongoose.model('Course', CourseSchema);
const Lesson = mongoose.model('Lesson', LessonSchema);
const Quiz = mongoose.model('Quiz', QuizSchema);
const FinalExam = mongoose.model('FinalExam', FinalExamSchema);
const Result = mongoose.model('Result', ResultSchema);
const FinalExamSubmission = mongoose.model('FinalExamSubmission', FinalExamSubmissionSchema);

const CertificateConfigSchema = new mongoose.Schema({
  selectedStyle: { type: String, default: 'classic' },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const CertificateConfig = mongoose.model('CertificateConfig', CertificateConfigSchema);

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountValue: { type: Number, required: true },
  expiryDate: String,
  usageLimit: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'expired', 'disabled'], default: 'active' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: String,
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const Coupon = mongoose.model('Coupon', CouponSchema);
const Contact = mongoose.model('Contact', ContactSchema);

// --- Utilities ---
const normalizeId = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeId);
  const newObj = obj.toObject ? obj.toObject() : { ...obj };
  if (newObj._id && !newObj.id) {
    newObj.id = newObj._id.toString();
  }
  return newObj;
};

const sendEmail = async (to, subject, templateName, data) => {
  console.log(`[EMAIL SERVICE] Sending ${templateName} to ${to}`);
  console.log(`[EMAIL SERVICE] Subject: ${subject}`);
  console.log(`[EMAIL SERVICE] Data:`, data);
  return true;
};

const seedAdmin = async () => {
  const adminEmail = 'admin@tci.com';
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Admin Account
  const adminData = {
    name: 'System Admin',
    email: adminEmail,
    password: hashedPassword,
    role: 'admin',
    isPaid: true
  };
  await User.findOneAndUpdate({ email: adminEmail }, adminData, { upsert: true });
  console.log('Admin account verified: admin@tci.com');
};

const seedCourses = async () => {
  const courses = [
    {
      title: 'General Transcription',
      description: 'Master the art of general transcription with our comprehensive certification program. Includes all essential modules and practice audio.',
      price: 199,
      status: 'active'
    },
    {
      title: 'Legal Transcription',
      description: 'Specialized training for legal transcription careers. Learn legal terminology, formatting, and industry-standard practices.',
      price: 299,
      status: 'active'
    },
    {
      title: 'Combo (General + Legal)',
      description: 'The ultimate professional package. Get both General and Legal transcription certifications at a discounted bundled rate.',
      price: 399,
      status: 'active'
    }
  ];

  for (const courseData of courses) {
    const existing = await Course.findOne({ title: courseData.title });
    if (!existing) {
      const newCourse = new Course(courseData);
      await newCourse.save();
      console.log(`Course seeded: ${courseData.title}`);
    }
  }
};

const seedFinalExam = async () => {
  const existing = await FinalExam.findOne();
  if (!existing) {
    const defaultExam = new FinalExam({
      title: 'TCI Final Certification Exam',
      mcqs: [
        { question: 'What does verbatim mean?', options: ['Summary', 'Word for word', 'Translated', 'Rough draft'], correctAnswer: 1 }
      ],
      transcriptionAudioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      transcriptionCorrectText: 'The quick brown fox jumps over the lazy dog.'
    });
    await defaultExam.save();
    console.log('Final Exam structure initialized.');
  }
};

const seedCertificateConfig = async () => {
  const existing = await CertificateConfig.findOne();
  if (!existing) {
    const defaultConfig = new CertificateConfig({ selectedStyle: 'classic' });
    await defaultConfig.save();
    console.log('Default certificate configuration seeded.');
  }
};

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- API Routes ---
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: normalizeId(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    isMockDB: false,
    database: mongoose.connection.readyState === 1 ? mongoose.connection.name : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, address, phoneNumber, plan } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, address, phoneNumber, plan: plan || 'General Transcription' });
    await user.save();

    const enrollment = new Enrollment({ userId: user._id, userName: user.name, userEmail: user.email, status: 'partial' });
    await enrollment.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    const userWithoutPassword = normalizeId(user);
    delete userWithoutPassword.password;
    res.status(201).json({ user: userWithoutPassword, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    const userWithoutPassword = normalizeId(user);
    delete userWithoutPassword.password;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(normalizeId(courses));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lessons', async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = courseId ? { courseId } : {};
    const lessons = await Lesson.find(filter).sort({ order: 1 });
    res.json(normalizeId(lessons));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/results', authenticateToken, async (req, res) => {
  try {
    const resultData = req.body;
    const result = new Result(resultData);
    await result.save();
    res.status(201).json(normalizeId(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/enrollments', authenticateToken, isAdmin, async (req, res) => {
  try {
    const enrols = await Enrollment.find().sort({ date: -1 });
    res.json(normalizeId(enrols));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/results', authenticateToken, isAdmin, async (req, res) => {
  try {
    const results = await Result.find().sort({ date: -1 });
    res.json(normalizeId(results));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/submissions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const submissions = await FinalExamSubmission.find().sort({ submittedAt: -1 });
    res.json(normalizeId(submissions));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/final-exam', async (req, res) => {
  try {
    const exam = await FinalExam.findOne();
    res.json(normalizeId(exam));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payment', authenticateToken, async (req, res) => {
  try {
    const { plan, couponCode } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isPaid) return res.status(400).json({ error: 'User has already paid' });

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, status: 'active' });
      if (coupon) {
        const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
        const isLimitReached = coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit;
        if (!isExpired && !isLimitReached) {
          coupon.usageCount += 1;
          await coupon.save();
        }
      }
    }

    if (plan) {
      user.plan = plan;
    }

    user.isPaid = true;
    await user.save();
    
    let amount = 149.00;
    let courseTitle = 'General Transcription Certification';
    if (user.plan === 'Legal') {
      amount = 249.00;
      courseTitle = 'Legal Transcription Certification';
    }
    if (user.plan === 'Combo') {
      amount = 299.00;
      courseTitle = 'Combo (General + Legal) Certification';
    }

    await Enrollment.findOneAndUpdate(
      { userId: user._id }, 
      { 
        status: 'completed', 
        amount: amount,
        courseTitle: courseTitle,
        date: new Date().toISOString().split('T')[0] 
      },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lessons/:lessonId/quiz', authenticateToken, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { score } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (score >= 70) {
      if (!user.completedLessons.includes(lessonId)) {
        user.completedLessons.push(lessonId);
      }
    }
    
    user.quizResults.push({ lessonId, score, date: new Date().toISOString() });
    await user.save();
    
    res.json({ success: true, user: normalizeId(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/final-exam/submit', authenticateToken, async (req, res) => {
  try {
    const { submissionFile, submissionFileName, submissionFileType } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const submission = new FinalExamSubmission({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      submissionFile,
      submissionFileName,
      submissionFileType,
      status: 'pending',
      submittedAt: new Date().toISOString()
    });

    await submission.save();
    res.status(201).json(normalizeId(submission));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const profileData = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, profileData, { new: true }).select('-password');
    res.json(normalizeId(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });
    
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Management Endpoints ---

// Courses
app.post('/api/courses', authenticateToken, isAdmin, async (req, res) => {
  try {
    const courseData = req.body;
    const course = new Course(courseData);
    await course.save();
    res.status(201).json(normalizeId(course));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/courses/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const courseData = req.body;
    const course = await Course.findByIdAndUpdate(id, courseData, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(normalizeId(course));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/courses/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/contacts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(normalizeId(contacts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const contact = new Contact({ name, email, subject, message });
    await contact.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Certificate Config
app.get('/api/certificate-config', async (req, res) => {
  try {
    const config = await CertificateConfig.findOne() || { selectedStyle: 'classic' };
    res.json(normalizeId(config));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/certificate-config', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { selectedStyle } = req.body;
    const config = await CertificateConfig.findOneAndUpdate({}, { selectedStyle, updatedAt: new Date().toISOString() }, { new: true, upsert: true });
    res.json(normalizeId(config));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lessons
app.post('/api/lessons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const lessonData = req.body;
    const lesson = new Lesson(lessonData);
    await lesson.save();
    res.status(201).json(normalizeId(lesson));
  } catch (err) {
    if (err.message.includes('BSONObj size')) {
      return res.status(413).json({ error: 'Video file or payload too large for MongoDB (max 16MB). Use a URL instead.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lessons/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const lessonData = req.body;
    const lesson = await Lesson.findByIdAndUpdate(id, lessonData, { new: true });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(normalizeId(lesson));
  } catch (err) {
    if (err.message.includes('BSONObj size')) {
      return res.status(413).json({ error: 'Video file or payload too large for MongoDB (max 16MB). Use a URL instead.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lessons/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Lesson.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lessons/reorder', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { lessons } = req.body;
    for (const l of lessons) {
      await Lesson.findByIdAndUpdate(l.id, { order: l.order });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quizzes
app.get('/api/quizzes', async (req, res) => {
  try {
    const { lessonId } = req.query;
    const filter = lessonId ? { lessonId } : {};
    const quizzes = await Quiz.find(filter);
    res.json(normalizeId(quizzes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quizzes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const quizData = req.body;
    const quiz = new Quiz(quizData);
    await quiz.save();
    res.status(201).json(normalizeId(quiz));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/quizzes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const quizData = req.body;
    const quiz = await Quiz.findByIdAndUpdate(id, quizData, { new: true });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(normalizeId(quiz));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/quizzes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Quiz.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Final Exam Update
app.put('/api/final-exam', authenticateToken, isAdmin, async (req, res) => {
  try {
    const examData = req.body;
    const exam = await FinalExam.findOneAndUpdate({}, examData, { new: true, upsert: true });
    res.json(normalizeId(exam));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Review Submission
app.put('/api/admin/submissions/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reviewData = req.body;
    const submission = await FinalExamSubmission.findByIdAndUpdate(id, { ...reviewData, reviewedAt: new Date().toISOString() }, { new: true });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.json(normalizeId(submission));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Coupons
app.get('/api/admin/coupons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(normalizeId(coupons));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code, status: 'active' });

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    }

    // Check expiry
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }

    // Check usage limit
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    res.json(normalizeId(coupon));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/coupons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const couponData = req.body;
    const coupon = new Coupon(couponData);
    await coupon.save();
    res.status(201).json(normalizeId(coupon));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/coupons/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contacts
app.get('/api/admin/contacts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(normalizeId(contacts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/contacts/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const contact = await Contact.findByIdAndUpdate(id, { status }, { new: true });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(normalizeId(contact));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ joinedDate: -1 });
    res.json(normalizeId(users));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Integration ---
async function startServer() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  // FIXED catch-all route
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
