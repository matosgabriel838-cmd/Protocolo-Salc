# **App Name**: CreditFlow

## Core Features:

- Secure Access Control: Role-based access control with admin, operator, and approver roles to manage permissions using feature flags.
- Organization Management: Admin panel to manage Military Organizations (OMs) including adding, listing, and deleting OMs.
- Credit Note Inclusion: Add and manage Credit Notes (NCs) with validation rules to ensure data integrity. Send alerts for approaching expiration dates.
- Credit Sharing: Distribute the value of a parent NC among subordinate OMs. The system ensures that the sum of shares does not exceed the total value of the NC.
- Acquisition Request Protocol: Automated generation of control codes. The application intelligently filters available NCs based on the requesting OM and available balance. Implements balance calculation for P_Reqs.
- Encumbrance Launch: Process acquisition requests. Record NE numbers, dates, and statuses, enabling fine adjustments of values at the time of commitment.
- Nullification and Cancellation: Automate reversals of the value of nullified notes and register cancellations of debts, with manual entry of NE numbers.

## Style Guidelines:

- Primary color: Dark Blue (#2C3E50) for a professional and trustworthy feel.
- Background color: Light Gray (#F0F3F4) for a clean and modern interface.
- Accent color: Orange (#E34A29) to highlight key actions and alerts.
- Body and headline font: 'Inter', sans-serif, providing a modern, clean and readable experience.
- Use a consistent set of minimalist icons for navigation and actions.
- Design a clear and structured layout, using tables and forms to display and manage data efficiently.
- Employ subtle transitions to enhance user experience.