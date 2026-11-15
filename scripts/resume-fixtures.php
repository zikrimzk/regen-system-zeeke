<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

// Fictional content only. No database, account, network, AI or email calls.
$professional = ReGen\TemplateCatalog::sample('modern');
$professional['sectionOrder'] = ['summary','experience','education','skills','certifications'];
$graduate = $professional;
$graduate['personal'] = ['fullName'=>'Amelia Tan','jobTitle'=>'Graduate Software Engineer','email'=>'amelia.tan@example.com','phone'=>'+60 12 555 0148','address'=>'Petaling Jaya, Selangor','linkedin'=>'linkedin.com/in/amelia-tan-example'];
$graduate['summary'] = 'Computer science graduate with practical experience building accessible web applications and analysing service data. Combines clear technical writing with a careful approach to testing and collaborative problem solving.';
$graduate['sectionOrder'] = ['summary','education','projects','experience','skills','achievements','certifications'];
$graduate['education'] = [['degree'=>'Bachelor of Computer Science (Honours)','institution'=>'Universiti Malaya','startDate'=>'2022-09','endDate'=>'2026-06','cgpa'=>'3.78 / 4.00','academicResultType'=>'cgpa']];
$graduate['experience'] = [['jobTitle'=>'Software Engineering Intern','company'=>'Northstar Digital','location'=>'Kuala Lumpur','startDate'=>'2025-06','endDate'=>'2025-09','bullets'=>['Implemented accessible form components and added validation for three customer registration journeys.','Investigated support issues with a senior engineer and documented repeatable steps for the team.']]];
$graduate['projects'] = [['title'=>'Community Services Directory','type'=>'Final-year project','technologies'=>'PHP, MySQL, JavaScript','startDate'=>'2025-10','endDate'=>'2026-04','bullets'=>['Built a searchable directory for local services with responsive navigation and keyboard-accessible filters.','Tested the prototype with 12 volunteers and simplified the search flow using their feedback.']],['title'=>'Student Society Reporting Dashboard','type'=>'Team project','technologies'=>'Python, SQL','startDate'=>'2025-02','endDate'=>'2025-05','bullets'=>['Cleaned event registration records and created a dashboard to help committee members plan attendance.']]];
$graduate['skills'] = ['technical'=>'PHP, JavaScript, SQL, Python','software'=>'Git, MySQL, Figma','language'=>'English (fluent), Bahasa Malaysia (fluent), Mandarin (conversational)'];
$graduate['achievements'] = ['Dean\'s List, four semesters, 2023-2025'];
$graduate['certifications'] = [];
$senior = $professional;
$senior['personal'] = ['fullName'=>'Nadia Rahman','jobTitle'=>'Finance and Operations Director','email'=>'nadia.rahman@example.com','phone'=>'+60 12 555 0162','address'=>'Shah Alam, Selangor','linkedin'=>'linkedin.com/in/nadia-rahman-example'];
$senior['summary'] = 'Finance and operations leader with 14 years of experience in manufacturing and professional services. Leads budgeting, management reporting and operational improvement programmes, with a focus on reliable controls, practical decisions and developing capable teams.';
$senior['experience'] = [];
$roles = [
 ['Finance and Operations Director','Meridian Manufacturing','2021-01','Present'],
 ['Senior Finance Manager','Meridian Manufacturing','2017-03','2020-12'],
 ['Finance Manager','Westbridge Advisory','2013-07','2017-02'],
 ['Financial Analyst','Westbridge Advisory','2011-06','2013-06'],
];
foreach ($roles as $index => [$role,$company,$start,$end]) {
 $senior['experience'][] = ['jobTitle'=>$role,'company'=>$company,'location'=>'Selangor, Malaysia','startDate'=>$start,'endDate'=>$end,'bullets'=>[
  'Led monthly management reporting and translated operating results into clear actions for business leaders.',
  'Partnered with department heads to build annual budgets, investigate variances and improve forecast accuracy.',
  'Simplified reconciliation procedures and introduced review checkpoints to strengthen financial controls.',
  'Developed team members through practical coaching, documented responsibilities and regular feedback.',
 ]];
}
$senior['education'] = [['degree'=>'Master of Business Administration','institution'=>'Universiti Putra Malaysia','startDate'=>'2015-09','endDate'=>'2017-06'],['degree'=>'Bachelor of Accounting (Honours)','institution'=>'Universiti Teknologi MARA','startDate'=>'2007-07','endDate'=>'2011-04']];
$senior['skills'] = ['technical'=>'Budgeting, forecasting, management reporting, financial controls, process improvement','software'=>'Microsoft Excel, Power BI, SAP','interpersonal'=>'Stakeholder communication, team development, negotiation','language'=>'English (fluent), Bahasa Malaysia (fluent)'];
$senior['certifications'] = ['Chartered Institute of Management Accountants, 2016','Lean Six Sigma Green Belt, 2019'];
$senior['achievements'] = ['Reduced the monthly reporting cycle from eight working days to five through standardised inputs and clearer ownership.','Led the finance workstream for an ERP rollout covering three operating sites without interrupting month-end reporting.'];
$stress = $senior;
$stress['personal']['fullName'] = 'Nur Aisyah Balqis Binti Abdul Rahman Abdullah';
$stress['personal']['email'] = 'nur.aisyah.balqis.professional@example.com';
$stress['personal']['linkedin'] = 'https://www.linkedin.com/in/' . str_repeat('professional-profile-', 9) . 'final';
$stress['experience'][0]['jobTitle'] = 'Regional Director of Financial Planning, Business Transformation and Operational Excellence';
$stress['experience'][0]['company'] = 'Southeast Asia Manufacturing and Shared Services Group';
$stress['experience'][0]['bullets'] = [];
for ($i=1;$i<=24;$i++) $stress['experience'][0]['bullets'][] = "Initiative $i: " . str_repeat('Coordinated the reporting programme across multiple operating teams, reviewed source information and documented clear follow-up actions. ', 3);
$stress['summary'] = str_repeat('Experienced leader combining reliable analysis with clear communication and practical delivery. ', 7);
$sparse = ['templateId'=>'modern','personal'=>['fullName'=>'Daniel Lee','email'=>'daniel.lee@example.com','phone'=>'+60 12 555 0176'], 'experience'=>[['company'=>'Cedar Services','endDate'=>'2026-04','bullets'=>['Prepared customer records and kept service documentation up to date.']]],'skills'=>['technical'=>'Customer support, record keeping']];
return ['professional'=>$professional,'graduate'=>$graduate,'senior'=>$senior,'stress'=>$stress,'sparse'=>$sparse];
