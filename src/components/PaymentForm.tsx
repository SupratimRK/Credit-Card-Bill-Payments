import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Smartphone, IndianRupee, QrCode, AlertCircle, CheckCircle2, Smartphone as Smartphone2, CreditCard as CreditCardIcon, AlertTriangle, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode.react';
import { BANKS, validateForm, generateUpiId, validateCard, findBankByIssuer, getCardSchemeIcon } from '../utils';
import { FormData, ValidationErrors, CardValidationResponse, CardGroup } from '../types';

const PaymentForm: React.FC = () => {
  const initialFormState = {
    mobileNumber: '',
    cardNumber: '',
    bank: '',
    amount: '', // amount field is optional
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cardInfo, setCardInfo] = useState<CardValidationResponse | null>(null);
  const [cardError, setCardError] = useState<string>('');
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [detectedIssuer, setDetectedIssuer] = useState<string | null>(null);
  const [cardGroups, setCardGroups] = useState<CardGroup[]>([
    { value: '', focused: false },
    { value: '', focused: false },
    { value: '', focused: false },
    { value: '', focused: false }
  ]);

  const mobileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null]);
  const cardInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleMobileNumberChange = (index: number, value: string) => {
    // Since type="number" may allow non-string values, we convert to string and then filter digits
    const newValue = value.replace(/\D/g, '').slice(0, 2);
    let updatedMobileNumber = formData.mobileNumber.split('');
    updatedMobileNumber[index * 2] = newValue[0] || '';
    updatedMobileNumber[index * 2 + 1] = newValue[1] || '';
    
    const finalMobileNumber = updatedMobileNumber.join('');
    setFormData(prev => ({ ...prev, mobileNumber: finalMobileNumber }));

    if (newValue.length === 2 && index < 4) {
      mobileInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCardGroupChange = (index: number, value: string) => {
    const newValue = value.replace(/\D/g, '').slice(0, 4);
    const newGroups = [...cardGroups];
    newGroups[index].value = newValue;
    setCardGroups(newGroups);

    const fullCardNumber = newGroups.map(g => g.value).join('');
    setFormData(prev => ({ ...prev, cardNumber: fullCardNumber }));

    if (fullCardNumber.length === 0) {
      setCardInfo(null);
      setCardError('');
      setFormData(prev => ({ ...prev, bank: '' }));
      setDetectedIssuer(null);
      setShowManualSelection(false);
    } else if (fullCardNumber.length >= 6) {
      validateCardNumber(fullCardNumber);
    }

    if (newValue.length === 4 && index < 3) {
      cardInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCardGroupFocus = (index: number) => {
    const newGroups = cardGroups.map((g, i) => ({
      ...g,
      focused: i === index
    }));
    setCardGroups(newGroups);
  };

  const handleMobileGroupFocus = (index: number) => {
    mobileInputRefs.current[index]?.classList.add('border-blue-500', 'ring-2', 'ring-blue-200');
  };

  const handleMobileGroupBlur = (index: number) => {
    mobileInputRefs.current[index]?.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200');
  };

  const handleBankSelection = (bankId: string) => {
    setFormData(prev => ({ ...prev, bank: bankId }));
    setShowManualSelection(false);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setErrors({});
    setCardInfo(null);
    setCardError('');
    setShowManualSelection(false);
    setDetectedIssuer(null);
    setCardGroups([
      { value: '', focused: false },
      { value: '', focused: false },
      { value: '', focused: false },
      { value: '', focused: false }
    ]);
    mobileInputRefs.current[0]?.focus();
  };

  const validateCardNumber = async (cardNumber: string) => {
    try {
      const cardData = await validateCard(cardNumber);
      setCardInfo(cardData);
      setCardError('');
      setDetectedIssuer(cardData.Issuer);
      
      if (cardData.Type !== 'CREDIT') {
        setCardError('Only credit cards are accepted');
        setShowManualSelection(false);
      } else if (cardData.Country.A2 !== 'IN') {
        setCardError('Only Indian credit cards are accepted');
        setShowManualSelection(false);
      } else {
        const matchedBank = findBankByIssuer(cardData.Issuer);
        if (matchedBank) {
          setFormData(prev => ({ ...prev, bank: matchedBank.id }));
          setShowManualSelection(false);
        } else {
          setShowManualSelection(true);
          setFormData(prev => ({ ...prev, bank: '' }));
        }
      }
    } catch (error) {
      setCardError('Auto-detection failed. Please select your issuer manually.');
      setCardInfo(null);
      setDetectedIssuer(null);
      setShowManualSelection(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!formData.bank) {
      setErrors(prev => ({ ...prev, cardNumber: 'Please select your card issuer' }));
      setShowManualSelection(true);
      return;
    }

    if (cardError || !cardInfo) {
      setErrors(prev => ({ ...prev, cardNumber: cardError || 'Card validation required' }));
      return;
    }

    setIsLoading(true);
    
    const selectedBank = BANKS.find(bank => bank.id === formData.bank);
    if (selectedBank) {
      const upiId = generateUpiId(formData, selectedBank);
      const upiUrl = `upi://pay?pa=${upiId}&pn=${selectedBank.name}&am=${formData.amount}&cu=INR`;
      if (isMobile) {
        window.location.href = upiUrl;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
  };

  const selectedBank = BANKS.find(bank => bank.id === formData.bank);
  const upiId = selectedBank ? generateUpiId(formData, selectedBank) : '';
  const isCardComplete = formData.cardNumber.length === 16;
  const isMobileComplete = formData.mobileNumber.length === 10;
  const isFormValid = isCardComplete && isMobileComplete && !cardError && cardInfo && formData.bank;

  return (
    <div className="min-h-screen pattern-background">
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-6 w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Credit Card Payment</h1>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Reset Form"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Smartphone className="inline-block mr-2 h-4 w-4" />
                Mobile Number
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[...Array(5)].map((_, i) => (
                  <input
                    key={i}
                    ref={el => mobileInputRefs.current[i] = el}
                    type="number"
                    maxLength={2}
                    value={formData.mobileNumber.slice(i * 2, (i * 2) + 2)}
                    onChange={(e) => handleMobileNumberChange(i, e.target.value)}
                    onFocus={() => handleMobileGroupFocus(i)}
                    onBlur={() => handleMobileGroupBlur(i)}
                    className="h-12 w-full text-center text-lg font-medium text-gray-700 rounded-lg border border-gray-300 focus:outline-none transition-all duration-200"
                    placeholder="••"
                  />
                ))}
              </div>
              {errors.mobileNumber && (
                <p className="mt-1 text-sm text-red-500">{errors.mobileNumber}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="inline-block mr-2 h-4 w-4" />
                Card Number
              </label>
              <div className="grid grid-cols-4 gap-2">
                {cardGroups.map((group, index) => (
                  <input
                    key={index}
                    ref={el => cardInputRefs.current[index] = el}
                    type="number"
                    maxLength={4}
                    value={group.value}
                    onChange={(e) => handleCardGroupChange(index, e.target.value)}
                    onFocus={() => handleCardGroupFocus(index)}
                    className={`h-12 w-full px-3 py-2 text-center text-lg font-medium text-gray-700 rounded-lg border ${
                      group.focused ? 'border-blue-500 ring-2 ring-blue-200' :
                      errors.cardNumber ? 'border-red-500' : 'border-gray-300'
                    } focus:outline-none transition-all duration-200`}
                    placeholder="••••"
                  />
                ))}
              </div>

              {cardInfo && !cardError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Card Network</span>
                        <div className="flex items-center">
                          {cardInfo.Scheme && (
                            <img 
                              src={getCardSchemeIcon(cardInfo.Scheme)} 
                              alt={cardInfo.Scheme}
                              className="h-4"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Card Type</span>
                        <span className="font-medium text-gray-900">{cardInfo.CardTier}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Detected Issuer</span>
                        <span className="font-medium text-gray-900">{detectedIssuer}</span>
                      </div>
                      {selectedBank && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-gray-600">Selected Bank</span>
                          <img 
                            src={selectedBank.logo} 
                            alt={selectedBank.name}
                            className="h-6"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!showManualSelection && (
                    <button
                      type="button"
                      onClick={() => setShowManualSelection(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Not your issuer? Select manually
                    </button>
                  )}
                </motion.div>
              )}

              {cardError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="inline-block mr-1 h-4 w-4" />
                    {cardError}
                  </p>
                </motion.div>
              )}

              {!formData.bank && cardInfo && !cardError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-yellow-50 p-3 rounded-lg border border-yellow-200"
                >
                  <div className="flex items-center text-yellow-800">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <p className="text-sm">We are unable to automatically detect your issuer. Kindly select your bank manually.</p>
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {showManualSelection && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <h3 className="font-medium text-gray-900 mb-3">Select Your Card Issuer</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {BANKS.map((bank) => (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => handleBankSelection(bank.id)}
                          className={`p-3 rounded-lg border transition-all flex items-center justify-center ${
                            formData.bank === bank.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <img 
                            src={bank.logo} 
                            alt={bank.name}
                            className="h-6"
                          />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <IndianRupee className="inline-block mr-2 h-4 w-4" />
                Amount in INR
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="h-12 w-full px-4 text-lg font-medium text-gray-700 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter amount"
                min="1"
                step="0.01"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
              )}
            </div>

            {isFormValid && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-50 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-center mb-4">
                  <QrCode className="h-6 w-6 text-gray-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Scan QR Code to Pay</h3>
                </div>
                <div className="flex justify-center bg-white p-4 rounded-lg shadow-inner">
                  <QRCode
                    value={`upi://pay?pa=${upiId}&pn=${selectedBank?.name}&am=${formData.amount}&cu=INR`}
                    size={200}
                    level="H"
                    includeMargin={true}
                    className="rounded-lg"
                  />
                </div>
                {formData.amount && (
                  <div className="flex items-center justify-center space-x-2 text-lg font-medium text-gray-900">
                    <IndianRupee className="h-5 w-5" />
                    <span>{parseFloat(formData.amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="text-center text-sm text-gray-600">
                  <p>Scan with any UPI-enabled app</p>
                  <div className="flex justify-center space-x-2 mt-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/UPI-Logo-vector.svg/200px-UPI-Logo-vector.svg.png" alt="UPI" className="h-6" />
                  </div>
                </div>
              </motion.div>
            )}

            {isFormValid && isMobile && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full bg-blue-600 text-white h-12 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <>
                    <Smartphone2 className="h-5 w-5" />
                    <span>Pay via UPI App</span>
                  </>
                )}
              </motion.button>
            )}
          </form>
        </motion.div>
        <footer className="mt-8 text-center text-gray-800">
          <p>Crafted with 💜 by Supratim</p>
        </footer>
      </div>
    </div>
  );
};

export default PaymentForm;
