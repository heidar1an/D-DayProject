import { useEffect, useRef, useState } from 'react';

import baleIcon from '../../images/icons/Asset 13.webp';
import experienceIcon from '../../images/icons/Asset 8.webp';
import graduationIcon from '../../images/icons/Asset 15 (2).webp';
import instagramIcon from '../../images/icons/Asset 14.webp';
import internetIcon from '../../images/icons/Asset 10.webp';
import learningIcon from '../../images/icons/Asset 1.webp';
import incomeIcon from '../../images/icons/Asset 2.webp';
import noGoalIcon from '../../images/icons/Asset 3.webp';
import friendsIcon from '../../images/icons/Asset 17.webp';
import helpingPeopleIcon from '../../images/icons/Asset 5.webp';
import personalInterestIcon from '../../images/icons/Asset 6.webp';
import familyJobIcon from '../../images/icons/Asset 7.webp';
import rubikaIcon from '../../images/icons/Asset 15.webp';
import sparklesIcon from '../../images/icons/Asset 9.webp';
import telegramIcon from '../../images/icons/Asset 11.webp';
import onboardingMascot from '../../images/pictures/ChatGPT Image ۲ شهریور ۱۴۰۵، ۱۳_۲۴_۴۵.png';

const registrationSteps = [
  {
    title: 'لطفا اطلاعات خواسته شده را وارد نمایید',
    fields: [
      {
        id: 'onboarding-first-name',
        name: 'firstName',
        placeholder: 'نام خود را اینجا وارد نمایید',
        type: 'text',
      },
      {
        id: 'onboarding-last-name',
        name: 'lastName',
        placeholder: 'نام خانوادگی خود را اینجا وارد نمایید',
        type: 'text',
      },
      {
        id: 'onboarding-username',
        name: 'username',
        placeholder: 'نام کاربری خود را اینجا وارد نمایید',
        type: 'text',
        prefix: '@',
      },
    ],
    note: 'نکات: نام کاربری شامل اشکال و نمادهایی مثل @#$&% نباشد.',
  },
  {
    title: 'نصف راه رو اومدی {نام خطاب}',
    variant: 'motivation',
  },
  {
    title: 'دیگه به آخرش رسیدیم',
    variant: 'referral',
  },
];

const motivationOptions = [
  { id: 'learning', label: 'یادگیری', icon: learningIcon },
  { id: 'income', label: 'درآمدی', icon: incomeIcon },
  { id: 'no-goal', label: 'هدفی ندارم', icon: noGoalIcon },
  { id: 'friends', label: 'دوستان و آشنایان', icon: friendsIcon },
  { id: 'helping-people', label: 'کمک به مردم', icon: helpingPeopleIcon },
  { id: 'personal-interest', label: 'علاقه شخصی', icon: personalInterestIcon },
  { id: 'family-job', label: 'شغل خانوادگی', icon: familyJobIcon },
  { id: 'experience', label: 'با خودم قرار اومدم تجربی', icon: experienceIcon },
];

const referralOptions = [
  { id: 'telegram', label: 'تلگرام', icon: telegramIcon },
  { id: 'internet', label: 'اینترنت', icon: internetIcon },
  { id: 'friends', label: 'دوستان', icon: friendsIcon },
  { id: 'university', label: 'دانشگاه', icon: graduationIcon },
  { id: 'bale', label: 'بله', icon: baleIcon },
  { id: 'instagram', label: 'اینستاگرام', icon: instagramIcon },
  { id: 'rubika', label: 'روبیکا', icon: rubikaIcon },
  { id: 'artificial-intelligence', label: 'هوش مصنوعی', icon: sparklesIcon },
];

const termOptions = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲'];

export default function SecondaryRegistrationLayout({ onBack, onComplete }) {
  const [step, setStep] = useState(0);
  const [isEntered, setIsEntered] = useState(false);
  const [isStepSwitching, setIsStepSwitching] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [profileData, setProfileData] = useState({
    university: '',
    term: '',
    motivations: [],
  });
  const [selectionError, setSelectionError] = useState('');
  const [referralSources, setReferralSources] = useState([]);
  const stepSwitchTimerRef = useRef(null);
  const currentStep = registrationSteps[step];
  const isMotivationStep = currentStep.variant === 'motivation';
  const isReferralStep = currentStep.variant === 'referral';
  const isChoiceStep = isMotivationStep || isReferralStep;
  const activeChoiceOptions = isMotivationStep ? motivationOptions : referralOptions;
  const activeChoices = isMotivationStep ? profileData.motivations : referralSources;

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setIsEntered(true));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(stepSwitchTimerRef.current);
  }, []);

  const moveToStep = (nextStep) => {
    if (isStepSwitching || nextStep < 0 || nextStep > registrationSteps.length - 1) {
      return;
    }

    setIsStepSwitching(true);
    window.clearTimeout(stepSwitchTimerRef.current);
    stepSwitchTimerRef.current = window.setTimeout(() => {
      setStep(nextStep);
      requestAnimationFrame(() => setIsStepSwitching(false));
    }, 260);
  };

  const handleProfileSelectChange = (event) => {
    const { name, value } = event.target;

    setProfileData((current) => ({
      ...current,
      [name]: value,
    }));
    setSelectionError('');
  };

  const toggleMotivation = (motivationId) => {
    const isSelected = profileData.motivations.includes(motivationId);

    if (isSelected) {
      setProfileData((current) => ({
        ...current,
        motivations: current.motivations.filter((id) => id !== motivationId),
      }));
      setSelectionError('');
      return;
    }

    if (profileData.motivations.length >= 2) {
      setSelectionError('حداکثر دو مورد را انتخاب کنید.');
      return;
    }

    setProfileData((current) => ({
      ...current,
      motivations: [...current.motivations, motivationId],
    }));
    setSelectionError('');
  };

  const toggleReferralSource = (sourceId) => {
    const isSelected = referralSources.includes(sourceId);

    if (isSelected) {
      setReferralSources((current) => current.filter((id) => id !== sourceId));
      setSelectionError('');
      return;
    }

    if (referralSources.length >= 2) {
      setSelectionError('حداکثر دو مورد را انتخاب کنید.');
      return;
    }

    setReferralSources((current) => [...current, sourceId]);
    setSelectionError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isChoiceStep && activeChoices.length === 0) {
      setSelectionError(
        isMotivationStep
          ? 'لطفاً حداقل یک انگیزه را انتخاب کنید.'
          : 'لطفاً حداقل یک گزینه را انتخاب کنید.',
      );
      return;
    }

    if (step < registrationSteps.length - 1) {
      moveToStep(step + 1);
      return;
    }

    setCompleted(true);
  };

  return (
    <main className="onboarding-page" dir="rtl">
      <section className={`onboarding-card ${isEntered ? 'is-visible' : ''}`}>
        <div className="onboarding-card__mascot">
          <img src={onboardingMascot} alt="شخصیت کارتونی تپش" />
        </div>

        {completed ? (
          <div className="onboarding-complete">
            <h1>ثبت نام شما کامل شد</h1>
            <p>حالا می‌توانید مسیر یادگیری خود را در تپش شروع کنید.</p>
            <button
              className="onboarding-button onboarding-button--primary"
              type="button"
              onClick={onComplete}
            >
              ورود به تپش
            </button>
          </div>
        ) : (
          <>
            <h1 className="onboarding-title">
              {isChoiceStep ? currentStep.title : 'خب، باید شروع کنیم'}
            </h1>

            <div className="onboarding-progress" aria-label={`مرحله ${step + 1} از ۳`}>
              {registrationSteps.map((item, index) => (
                <div
                  className={`onboarding-progress__step ${
                    index === step ? 'is-current' : index < step ? 'is-complete' : ''
                  }`}
                  key={item.title}
                >
                  <span>{['۱', '۲', '۳'][index]}</span>
                </div>
              ))}
            </div>

            <form
              className={`onboarding-form ${
                isMotivationStep ? 'onboarding-form--motivation' : ''
              } ${isReferralStep ? 'onboarding-form--referral' : ''} ${
                isStepSwitching ? 'is-switching' : ''
              }`}
              onSubmit={handleSubmit}
            >
              {isChoiceStep ? (
                <div className={`onboarding-profile ${isReferralStep ? 'is-referral' : ''}`}>
                  {isMotivationStep && (
                    <div className="onboarding-profile__selects">
                      <label className="onboarding-select">
                        <span className="sr-only">دانشگاه محل تحصیل</span>
                        <select
                          name="university"
                          value={profileData.university}
                          onChange={handleProfileSelectChange}
                          required
                        >
                          <option value="" disabled>
                            دانشگاه محل تحصیل
                          </option>
                          <option value="دانشگاه علوم پزشکی تهران">
                            دانشگاه علوم پزشکی تهران
                          </option>
                          <option value="دانشگاه علوم پزشکی ایران">
                            دانشگاه علوم پزشکی ایران
                          </option>
                          <option value="دانشگاه علوم پزشکی شهید بهشتی">
                            دانشگاه علوم پزشکی شهید بهشتی
                          </option>
                          <option value="سایر دانشگاه‌ها">سایر دانشگاه‌ها</option>
                        </select>
                      </label>

                      <label className="onboarding-select">
                        <span className="sr-only">ترم چندم هستید؟</span>
                        <select
                          name="term"
                          value={profileData.term}
                          onChange={handleProfileSelectChange}
                          required
                        >
                          <option value="" disabled>
                            ترم چندم هستید؟
                          </option>
                          {termOptions.map((term) => (
                            <option key={term} value={term}>
                              ترم {term}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <fieldset
                    className={`onboarding-motivation-picker ${
                      isReferralStep ? 'onboarding-referral-picker' : ''
                    }`}
                  >
                    <legend>
                      {isMotivationStep
                        ? 'انگیزه شما از تحصیل چیست؟'
                        : 'از چه طریق با ما آشنا شدید؟'}
                    </legend>
                    <p>حداکثر دو مورد</p>
                    <div className="onboarding-motivation-picker__options">
                      {activeChoiceOptions.map((choice) => {
                        const isSelected = activeChoices.includes(choice.id);

                        return (
                          <button
                            className={`onboarding-motivation-option ${
                              isReferralStep ? 'onboarding-referral-option' : ''
                            } ${isSelected ? 'is-selected' : ''}`}
                            type="button"
                            aria-pressed={isSelected}
                            key={choice.id}
                            onClick={() =>
                              isMotivationStep
                                ? toggleMotivation(choice.id)
                                : toggleReferralSource(choice.id)
                            }
                          >
                            <img src={choice.icon} alt="" aria-hidden="true" />
                            <span>{choice.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <p className="onboarding-profile__error" role="alert" aria-live="polite">
                    {selectionError}
                  </p>
                </div>
              ) : (
                <>
                  <h2>{currentStep.title}</h2>
                  <div className="onboarding-form__fields">
                    {currentStep.fields.map((field) => (
                      <label className="onboarding-field" htmlFor={field.id} key={field.id}>
                        <span className="sr-only">{field.placeholder}</span>
                        <input
                          id={field.id}
                          name={field.name}
                          type={field.type}
                          placeholder={field.placeholder}
                          required
                        />
                        {field.prefix && (
                          <span className="onboarding-field__prefix">{field.prefix}</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="onboarding-note">{currentStep.note}</p>
                </>
              )}

              <div
                className={`onboarding-actions ${
                  isChoiceStep ? 'onboarding-actions--choice' : ''
                }`}
              >
                <button
                  className="onboarding-button onboarding-button--secondary"
                  type="button"
                  onClick={() => (step === 0 ? onBack?.() : moveToStep(step - 1))}
                >
                  مرحله قبل
                </button>
                <button className="onboarding-button onboarding-button--primary" type="submit">
                  مرحله بعد
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
