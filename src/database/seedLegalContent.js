const mongoose = require('mongoose');
const dotenv = require('dotenv');
const LegalContent = require('../models/LegalContent');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Privacy Policy Content
const privacyPolicyHTML = `
<h2>1. Introduction</h2>
<p>Welcome to SoloAI! We value your trust and are committed to protecting your privacy. This Privacy Policy describes how we collect, use, and safeguard your personal information when you use our app and services.</p>

<h2>2. Information We Collect</h2>
<ul>
  <li>Personal details such as name, email, and phone number.</li>
  <li>Social media data when you connect your accounts.</li>
  <li>Usage data such as device information and in-app activity.</li>
</ul>

<h2>3. How We Use Your Information</h2>
<ul>
  <li>To personalize your experience.</li>
  <li>To provide AI-powered insights and recommendations.</li>
  <li>To communicate updates, offers, or support messages.</li>
</ul>

<h2>4. Data Protection & Security</h2>
<p>We use advanced encryption and secure servers to store your data safely. However, no online transmission is 100% secure, so please use the app responsibly.</p>

<h2>5. Third-Party Services</h2>
<p>SoloAI integrates with trusted third-party platforms like Google, Meta, and Bundle.social for authentication and content synchronization. Each of these services has its own privacy policy.</p>

<h2>6. Your Rights</h2>
<ul>
  <li>Request a copy of your data.</li>
  <li>Ask for corrections or deletions.</li>
  <li>Withdraw permissions for connected accounts.</li>
</ul>

<h2>7. Updates to this Policy</h2>
<p>We may update this Privacy Policy periodically. Continued use of the app after updates implies acceptance of the revised terms.</p>

<h2>8. Contact Us</h2>
<p>If you have any questions or concerns about this policy, reach us at:</p>
<p><strong>Email:</strong> <a href="mailto:support@soloai.app">support@soloai.app</a></p>
`;

// Terms of Use Content
const termsOfUseHTML = `
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using SoloAI, you agree to be bound by these Terms of Use. If you do not agree, please discontinue use immediately.</p>

<h2>2. User Responsibilities</h2>
<ul>
  <li>You must provide accurate information during registration.</li>
  <li>Do not use SoloAI for illegal or harmful purposes.</li>
  <li>You are responsible for maintaining confidentiality of your login credentials.</li>
</ul>

<h2>3. Intellectual Property</h2>
<p>All content, features, and functionality in SoloAI are the property of SoloAI or its licensors. You may not reproduce, modify, or distribute without permission.</p>

<h2>4. Third-Party Integrations</h2>
<p>SoloAI connects with third-party platforms like Instagram, Twitter, and Bundle.social. These are governed by their own terms and policies, which you must also follow.</p>

<h2>5. Limitation of Liability</h2>
<p>SoloAI shall not be held liable for any direct or indirect damages resulting from your use or inability to use the app or linked services.</p>

<h2>6. Termination</h2>
<p>We reserve the right to suspend or terminate access to your account if you violate these terms or engage in activities that may harm the platform or other users.</p>

<h2>7. Changes to Terms</h2>
<p>We may update these Terms of Use periodically. Continued use of the app after changes implies your acceptance of the revised terms.</p>

<h2>8. Contact Us</h2>
<p>If you have any questions about these Terms, please contact us at:</p>
<p><strong>Email:</strong> <a href="mailto:support@soloai.app">support@soloai.app</a></p>
`;

// FAQ Content
const faqHTML = `
<h2>What is SoloAI?</h2>
<p>SoloAI is your personal social-media companion that connects and analyzes your content performance using AI.</p>

<h2>Is my data safe?</h2>
<p>Absolutely. We store data securely and never share personal information with third parties without consent.</p>

<h2>Can I disconnect my accounts?</h2>
<p>Yes. You can disconnect any linked account anytime from the Connected Accounts section in Settings.</p>

<h2>Does SoloAI post automatically?</h2>
<p>No, posts are made without your approval. You're always in control of what gets published.</p>

<h2>How can I reach support?</h2>
<p>You can send us an inquiry from Settings → Help → Inquiry.</p>

<h2>What platforms does SoloAI support?</h2>
<p>SoloAI currently supports Instagram, Twitter (X), Facebook, TikTok, and Bundle.social for content synchronization and analytics.</p>

<h2>Is SoloAI free?</h2>
<p>SoloAI offers a free tier with basic features. Premium features are available through subscription plans.</p>

<h2>How do I delete my account?</h2>
<p>You can delete your account from Settings → Account → Delete Account. This action is permanent and will remove all your data.</p>

<h2>Can I export my data?</h2>
<p>Yes! You can request a copy of your data by contacting support at <a href="mailto:support@soloai.app">support@soloai.app</a>.</p>

<h2>What AI features does SoloAI provide?</h2>
<p>SoloAI provides content performance analytics, optimal posting time recommendations, hashtag suggestions, caption generation, and audience insights powered by AI.</p>
`;

// Seed function
const seedLegalContent = async () => {
  try {
    await connectDB();

    // Clear existing legal content
    await LegalContent.deleteMany({});
    console.log('Cleared existing legal content');

    // Create Privacy Policy
    const privacyPolicy = await LegalContent.create({
      type: 'privacy_policy',
      title: 'Privacy Policy',
      content: privacyPolicyHTML.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
      htmlContent: privacyPolicyHTML,
      isPublished: true,
    });
    console.log('✓ Privacy Policy created');

    // Create Terms of Use
    const termsOfUse = await LegalContent.create({
      type: 'terms_of_use',
      title: 'Terms of Use',
      content: termsOfUseHTML.replace(/<[^>]*>/g, ''),
      htmlContent: termsOfUseHTML,
      isPublished: true,
    });
    console.log('✓ Terms of Use created');

    // Create FAQ
    const faq = await LegalContent.create({
      type: 'faq',
      title: 'FAQ',
      content: faqHTML.replace(/<[^>]*>/g, ''),
      htmlContent: faqHTML,
      isPublished: true,
    });
    console.log('✓ FAQ created');

    console.log('\n========================================');
    console.log('Legal content seeded successfully!');
    console.log('========================================');
    console.log('\nCreated documents:');
    console.log(`1. Privacy Policy (ID: ${privacyPolicy._id})`);
    console.log(`2. Terms of Use (ID: ${termsOfUse._id})`);
    console.log(`3. FAQ (ID: ${faq._id})`);
    console.log('\nYou can now access these at:');
    console.log('- GET /api/v1/legal/privacy_policy/view');
    console.log('- GET /api/v1/legal/terms_of_use/view');
    console.log('- GET /api/v1/legal/faq/view');
    console.log('- GET /api/v1/legal/links (for app integration)');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding legal content:', error);
    process.exit(1);
  }
};

// Run the seed
seedLegalContent();
