import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle } from 'lucide-react';

const CONTACT_EMAIL = 'truegleai@proton.me';

const EMPTY = { name: '', email: '', company: '', website: '', budget: '', message: '' };

/*
 * Global advertiser contact modal. Opens when any HouseAd with action:'contact'
 * is clicked (they dispatch the 'truegle:open-advertise' window event).
 *
 * Submission is a plain mailto — it composes a prefilled email to the Truegle
 * inbox in the visitor's email app. No backend / API key required.
 */
export default function AdvertiseContactModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const handler = () => { setSent(false); setForm(EMPTY); setOpen(true); };
    window.addEventListener('truegle:open-advertise', handler);
    return () => window.removeEventListener('truegle:open-advertise', handler);
  }, []);

  const close = () => setOpen(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    const body =
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\n` +
      `Website: ${form.website}\nMonthly budget: ${form.budget}\n\n${form.message}`;
    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Advertising inquiry — Truegle')}` +
      `&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-gradient-to-br from-gray-900 to-black border-2 border-yellow-400/40 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-xs uppercase tracking-widest text-yellow-400/80">Advertise on Truegle</div>
                <h2 className="text-xl font-bold text-white">Claim this ad spot</h2>
              </div>
              <button onClick={close} className="text-white/50 hover:text-white p-1"><X size={20} /></button>
            </div>

            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Your email is ready to send</p>
                <p className="text-white/60 text-sm">We've opened your email app with the details filled in — just hit send and we'll be in touch.</p>
                <button onClick={close} className="mt-5 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3 mt-3">
                <p className="text-sm text-white/70">
                  Tell us about your product and we'll get you live.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input required value={form.name} onChange={set('name')} placeholder="Name *"
                    className="col-span-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50" />
                  <input required type="email" value={form.email} onChange={set('email')} placeholder="Email *"
                    className="col-span-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50" />
                  <input value={form.company} onChange={set('company')} placeholder="Company"
                    className="col-span-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50" />
                  <input value={form.website} onChange={set('website')} placeholder="Website"
                    className="col-span-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50" />
                </div>
                <input value={form.budget} onChange={set('budget')} placeholder="Monthly budget (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50" />
                <textarea value={form.message} onChange={set('message')} rows={3} placeholder="What would you like to advertise?"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 resize-none" />

                <button type="submit"
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-all">
                  <Send size={16} /> Send inquiry
                </button>

                {/* Offer fine print */}
                <p className="text-[11px] text-white/40 leading-snug pt-1">
                  *Launch offer: your <b className="text-white/60">first month is free</b>. After that, flat-rate
                  placements are just <span className="line-through opacity-70">$99/mo</span>{' '}
                  <b className="text-yellow-400">50% OFF — $49.99/mo, limited time only!</b> Any active paid
                  placement includes <b className="text-white/60">Truegle Premium free</b>. No tracking, no
                  contracts, cancel anytime.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
