import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LinkOpenChoice from './LinkOpenChoice';
import { inspectLink } from '../../api/linkInspect';

vi.mock('../../api/linkInspect', () => ({ inspectLink: vi.fn(), default: vi.fn() }));

const URL_IN = 'https://example.org/story';
const good = (over = {}) => ({
  ok: true, verdict: 'safe', findings: [], finalUrl: URL_IN, hops: [URL_IN],
  contentType: 'text/html', isDownload: false, isHtml: true,
  framing: { allowed: true, reason: 'ok' }, inAppPossible: true, ...over,
});
const mount = (url = URL_IN) => render(<LinkOpenChoice url={url} host="example.org" title="A story" />);
const frame = () => document.querySelector('iframe');

describe('LinkOpenChoice', () => {
  beforeEach(() => vi.resetAllMocks());

  it('always offers Open link, as a safe new-tab link', () => {
    mount();
    const a = screen.getByRole('link', { name: /open link/i });
    expect(a).toHaveAttribute('href', URL_IN);
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toMatch(/noopener/);
  });

  it('checks first and opens NOTHING until the person confirms', async () => {
    inspectLink.mockResolvedValue(good());
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    expect(await screen.findByText(/open it inside truegle\?/i)).toBeInTheDocument();
    expect(inspectLink).toHaveBeenCalledWith(URL_IN, expect.anything());
    expect(frame()).toBeNull();                       // confirm step: still no frame
    fireEvent.click(screen.getAllByRole('button', { name: /open in app/i })[0]);
    await waitFor(() => expect(frame()).not.toBeNull());
  });

  it('cancel returns to the start with no frame', async () => {
    inspectLink.mockResolvedValue(good());
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(frame()).toBeNull();
    expect(screen.getByRole('button', { name: /open in app/i })).toBeInTheDocument();
  });

  it('opens the address that was CHECKED (after redirects), not the pasted one', async () => {
    const landed = 'https://www.example.org/final';
    inspectLink.mockResolvedValue(good({ finalUrl: landed, hops: [URL_IN, landed] }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    await screen.findByText(/open it inside truegle\?/i);
    fireEvent.click(screen.getAllByRole('button', { name: /open in app/i })[0]);
    await waitFor(() => expect(frame().getAttribute('src')).toBe(landed));
  });

  it('asks more carefully when the check found something', async () => {
    inspectLink.mockResolvedValue(good({ verdict: 'caution', findings: [{ level: 'caution', text: 'The link ends up on elsewhere.net.' }] }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    expect(await screen.findByText(/take care/i)).toBeInTheDocument();
    expect(screen.getByText(/ends up on elsewhere\.net/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open anyway/i })).toBeInTheDocument();
  });

  it.each([
    ['a site that forbids framing', { inAppPossible: false, framing: { allowed: false, reason: 'The site forbids being shown inside other sites.' } }, /forbids being shown/i],
    ['a download', { isDownload: true, isHtml: false, inAppPossible: false, verdict: 'caution' }, /not a web page/i],
    ['a program', { verdict: 'danger', findings: [{ level: 'danger', text: 'This link is a program.' }], inAppPossible: false }, /unsafe/i],
    ['an unencrypted page', { finalUrl: 'http://example.org/story', verdict: 'caution' }, /only shows encrypted/i],
  ])('does not open %s in the app, and explains why', async (_n, over, message) => {
    inspectLink.mockResolvedValue(good(over));
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open anyway/i })).toBeNull();   // no way to confirm a blocked link
    expect(frame()).toBeNull();
    expect(screen.getByRole('link', { name: /open link/i })).toBeInTheDocument();   // the way out stays
  });

  it.each(['unreachable', 'refused', 'busy'])('a failed check (%s) never opens in-app', async (reason) => {
    inspectLink.mockResolvedValue({ ok: false, reason });
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    await screen.findByRole('status');
    expect(frame()).toBeNull();
    expect(screen.queryByRole('button', { name: /open anyway/i })).toBeNull();
    expect(screen.getByRole('link', { name: /open link/i })).toBeInTheDocument();
  });

  it('does not offer in-app for a site known to refuse framing', () => {
    render(<LinkOpenChoice url="https://www.nytimes.com/a" host="nytimes.com" title="t" />);
    expect(screen.queryByRole('button', { name: /open in app/i })).toBeNull();
    expect(screen.getByText(/opens on nytimes\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open link/i })).toBeInTheDocument();
  });

  it('does not offer in-app for an address shaped like a trick', () => {
    render(<LinkOpenChoice url="https://user:pw@example.org/a" host="example.org" title="t" />);
    expect(screen.queryByRole('button', { name: /open in app/i })).toBeNull();
    expect(screen.getByText(/not offered in the app/i)).toBeInTheDocument();
  });

  it('shows the honest limit of the check', async () => {
    inspectLink.mockResolvedValue(good());
    mount();
    fireEvent.click(screen.getByRole('button', { name: /open in app/i }));
    expect(await screen.findByText(/isn.t a guarantee/i)).toBeInTheDocument();
  });
});
