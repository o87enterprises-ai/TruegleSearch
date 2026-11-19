// The OSINT tool list on its own (no panel, markdown or logo) so the landing page can show it
// without downloading the whole investigation panel.
import { MapPin, Server, Shield, Mail, Phone, AtSign } from 'lucide-react';

export const OSINT_TOOLS = [
  { id: 'ip', label: 'IP Lookup', icon: MapPin, placeholder: 'e.g. 8.8.8.8', hint: 'Geolocate an IPv4 address' },
  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'e.g. example.com', hint: 'Resolve DNS records' },
  { id: 'whois', label: 'WHOIS', icon: Shield, placeholder: 'e.g. example.com', hint: 'Domain registration details' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'e.g. name@example.com', hint: 'Validity, MX, disposable/role & Gravatar' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: 'e.g. +14155552671', hint: 'Validity, line type, country & formats (include country code)' },
  { id: 'username', label: 'Username / Name', icon: AtSign, placeholder: 'username or full name (spaces OK)', hint: 'Find profiles across platforms — usernames or real names' },
];
