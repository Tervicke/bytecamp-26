import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getCompanies,
  createCompany,
  getPersons,
  createPerson,
  getBankAccounts,
  createBankAccount,
  getEntity,
} from '../controllers/entities.controller.js';

const router = Router();

// All entity routes are admin-only
router.use(verifyToken);

router.get('/companies', getCompanies);
router.post('/companies', createCompany);

router.get('/persons', getPersons);
router.post('/persons', createPerson);

router.get('/accounts', getBankAccounts);
router.post('/accounts', createBankAccount);

// Generic single-entity lookup (must come after specific routes)
router.get('/:id', getEntity);

export default router;
