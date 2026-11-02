"""
Quantum tunneling: a visual simulation of the time-dependent Schrodinger equation
=================================================================================
    i dψ/dt = [ -1/2 d²/dx² + V(x) ] ψ          (natural units: ħ = m = 1)

Solved with the split-step Fourier method (exactly unitary => probability conserved).

What you see
  • Top      : Re ψ and Im ψ  - the wave function itself (it is complex!)
  • Middle   : |ψ|² - the probability density. Colour encodes the PHASE of ψ,
               brightness/height encodes the probability.
  • Bottom L : momentum-space distribution |ψ(k)|² (the Fourier transform)
  • Bottom R : probability of finding the particle left / inside / right of the barrier

Usage
    python tunneling_sim.py            live animation
    python tunneling_sim.py --save     write tunneling.gif
    python tunneling_sim.py --still    write tunneling_still.png (publication-quality frame)
    python tunneling_sim.py --check    headless physics sanity check
"""
import sys
import numpy as np
import matplotlib
if any(a in sys.argv for a in ("--save", "--still", "--check")):
    matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.animation import FuncAnimation, PillowWriter
from matplotlib.colors import ListedColormap, hsv_to_rgb
from matplotlib.patches import Polygon

# ============================================================================
# 1. PARAMETERS - tweak these and re-run
# ============================================================================
N        = 2048        # grid points (power of 2 => fast FFT)
L        = 200.0       # domain: x in [-L/2, L/2]
dt       = 0.02        # time step
x0       = -30.0       # initial packet centre
sigma    = 3.0         # packet width (position space)
k0       = 2.0         # mean wavenumber  => E = k0²/2
V0       = 2.5         # barrier height
a        = 1.0         # barrier width
T_END    = 36.0        # total simulated time
STEPS_PER_FRAME = 8

# ============================================================================
# 2. PHYSICS CORE
# ============================================================================
x  = np.linspace(-L/2, L/2, N, endpoint=False)
dx = x[1] - x[0]
k  = 2*np.pi*np.fft.fftfreq(N, d=dx)
V  = np.where(np.abs(x) < a/2, V0, 0.0)
E0 = k0**2 / 2

def gaussian_packet(x, x0, sigma, k0):
    psi = np.exp(-(x - x0)**2 / (4*sigma**2)) * np.exp(1j*k0*x)
    return psi / np.sqrt(np.sum(np.abs(psi)**2) * dx)

half_V  = np.exp(-0.5j * V * dt)
kinetic = np.exp(-0.5j * k**2 * dt)
edge    = 20.0                                            # soft absorbing boundary
mask    = np.exp(-(np.clip(np.abs(x) - (L/2 - edge), 0, None) / edge)**2)

def step(psi):
    psi = half_V * psi
    psi = np.fft.ifft(kinetic * np.fft.fft(psi))
    psi = half_V * psi
    return psi * mask

def prob(psi):          return np.abs(psi)**2
def norm(psi):          return np.sum(prob(psi)) * dx
def region(psi, lo, hi):
    m = (x >= lo) & (x < hi)
    return np.sum(prob(psi[m])) * dx

def analytic_T(E, V0, a):
    kappa = np.sqrt(2*(V0 - E))
    return 1.0 / (1.0 + (V0**2 * np.sinh(kappa*a)**2) / (4*E*(V0 - E)))

# ----------------------------------------------------------------------------
# Run the whole simulation up front, storing one wave function per frame
# ----------------------------------------------------------------------------
n_frames = int(T_END / (dt * STEPS_PER_FRAME))
psi = gaussian_packet(x, x0, sigma, k0)
frames = []
for _ in range(n_frames + 1):
    frames.append(psi.copy())
    for _ in range(STEPS_PER_FRAME):
        psi = step(psi)
times = np.arange(n_frames + 1) * STEPS_PER_FRAME * dt
P_left  = np.array([region(p, -L/2, -a/2) for p in frames])
P_in    = np.array([region(p, -a/2,  a/2) for p in frames])
P_right = np.array([region(p,  a/2,  L/2) for p in frames])

if "--check" in sys.argv:
    print(f"Norm at end        : {norm(frames[-1]):.6f}")
    print(f"Reflected   R      : {P_left[-1]:.4f}")
    print(f"Transmitted T      : {P_right[-1]:.4f}   (R+T = {P_left[-1]+P_right[-1]:.4f})")
    print(f"Analytic T(E={E0})  : {analytic_T(E0, V0, a):.4f}  (single-energy plane wave)")
    sys.exit()

# ============================================================================
# 3. VISUAL STYLE
# ============================================================================
BG, PANEL, GRID = "#070b14", "#0d1322", "#1b2436"
TXT, DIM        = "#e6ecf8", "#7f8ba3"
CYAN, MAGENTA   = "#4dd0e1", "#ff6ec7"
AMBER, GREEN    = "#ffb347", "#6ee7a8"
BLUE, VIOLET    = "#5b8cff", "#b08cff"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "text.color": TXT, "axes.labelcolor": DIM,
    "xtick.color": DIM, "ytick.color": DIM, "axes.edgecolor": GRID,
})

# Colour map for the complex phase arg(ψ) in [-π, π]
_h = np.linspace(0, 1, 256)
PHASE_CMAP = ListedColormap(hsv_to_rgb(np.stack([_h, np.full(256, 0.62), np.full(256, 1.0)], -1)))

def style(ax, ylabel=None, xlabel=None):
    ax.set_facecolor(PANEL)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.grid(True, color=GRID, lw=0.6, alpha=0.7)
    ax.tick_params(length=0, labelsize=8)
    if ylabel: ax.set_ylabel(ylabel, fontsize=9)
    if xlabel: ax.set_xlabel(xlabel, fontsize=9)

def barrier(ax, ymax, tall=False):
    ax.axvspan(-a/2, a/2, color=AMBER, alpha=0.9 if tall else 0.55, lw=0, zorder=4)
    ax.axvspan(-a/2 - 0.6, a/2 + 0.6, color=AMBER, alpha=0.15, lw=0, zorder=3)  # glow

fig = plt.figure(figsize=(12, 9.2), facecolor=BG)
gs  = gridspec.GridSpec(3, 2, height_ratios=[1.1, 1.9, 1.25], hspace=0.38, wspace=0.18,
                        left=0.07, right=0.97, top=0.865, bottom=0.07)
ax_w = fig.add_subplot(gs[0, :])
ax_d = fig.add_subplot(gs[1, :], sharex=ax_w)
ax_k = fig.add_subplot(gs[2, 0])
ax_p = fig.add_subplot(gs[2, 1])

fig.text(0.07, 0.962, "Quantum Tunneling", fontsize=24, fontweight="bold", color=TXT, va="center")
fig.text(0.07, 0.924,
         f"A Gaussian wave packet (E = {E0:.1f}) meets a barrier (V₀ = {V0}, width {a}).  "
         f"Classically it must bounce back  -  quantum mechanically, part of it gets through.",
         fontsize=10, color=DIM, va="center")

XLIM = (-50, 50)

# Adaptive vertical scale: follows the peak height smoothly, so the interference
# fringes during the collision are never clipped and the late-time packets stay readable.
def smooth_scale(need, pad=14, w=15):
    run = np.array([need[max(0, i-pad):i+pad+1].max() for i in range(len(need))])
    return np.convolve(np.pad(run, (w//2, w//2), mode="edge"), np.ones(w)/w, "valid")
DMAX = smooth_scale(np.array([prob(p).max() for p in frames]) * 1.15)
WMAX = np.sqrt(DMAX) * 1.02
dmax, wmax = DMAX[0], WMAX[0]

# ---- Top: Re ψ, Im ψ -------------------------------------------------------
style(ax_w, "ψ(x)")
plt.setp(ax_w.get_xticklabels(), visible=False)
l_im, = ax_w.plot(x, frames[0].imag, color=MAGENTA, lw=1.1, alpha=0.9, label="Im ψ")
l_re, = ax_w.plot(x, frames[0].real, color=CYAN,    lw=1.1, alpha=0.95, label="Re ψ")
barrier(ax_w, wmax)
ax_w.set_xlim(*XLIM); ax_w.set_ylim(-wmax, wmax)
ax_w.set_title("Wave function  ψ(x,t)  -  complex-valued", loc="left", fontsize=10, color=TXT, pad=6)
ax_w.legend(loc="upper right", fontsize=8, frameon=False, ncol=2, labelcolor=TXT)

# ---- Middle: |ψ|², coloured by phase --------------------------------------
style(ax_d, "|ψ(x)|²", "position  x")
img = ax_d.imshow(np.zeros((64, N, 4)), extent=[x[0], x[-1], 0, dmax], origin="lower",
                  aspect="auto", zorder=2, interpolation="bilinear")
poly = Polygon([[x[0], 0], [x[-1], 0]], closed=True, transform=ax_d.transData, fc="none", ec="none")
img.set_clip_path(poly)
l_glow, = ax_d.plot(x, np.zeros(N), color="white", lw=7,   alpha=0.07, zorder=3)
l_edge, = ax_d.plot(x, np.zeros(N), color="white", lw=1.5, alpha=0.95, zorder=3)
barrier(ax_d, dmax, tall=True)
ax_d.text(0, 0.965, f"V₀ = {V0}", transform=ax_d.get_xaxis_transform(), ha="center", va="top", fontsize=9, color=AMBER, fontweight="bold",
          bbox=dict(fc=PANEL, ec="none", pad=1.5), zorder=6)
ax_d.set_xlim(*XLIM); ax_d.set_ylim(0, dmax)
ax_d.set_title("Probability density  |ψ|²   (colour = phase of ψ)", loc="left", fontsize=10, color=TXT, pad=6)

txt_t = ax_d.text(0.012, 0.93, "", transform=ax_d.transAxes, fontsize=12, fontweight="bold", va="top")
txt_T = ax_d.text(0.988, 0.40, "", transform=ax_d.transAxes, fontsize=11, ha="right", va="top", color=GREEN)
txt_R = ax_d.text(0.988, 0.31, "", transform=ax_d.transAxes, fontsize=11, ha="right", va="top", color=BLUE)

cax = ax_d.inset_axes([0.79, 0.885, 0.19, 0.045])
cax.imshow(np.linspace(0, 1, 256)[None], cmap=PHASE_CMAP, aspect="auto", extent=[-np.pi, np.pi, 0, 1])
cax.set_yticks([]); cax.set_xticks([-np.pi, 0, np.pi]); cax.set_xticklabels(["-π", "0", "π"])
cax.tick_params(length=2, labelsize=7, pad=1); cax.xaxis.set_ticks_position("bottom")
for s in cax.spines.values(): s.set_visible(False)
cax.set_title("phase  arg ψ", fontsize=7.5, color=DIM, pad=2)

# ---- Bottom-left: momentum space ------------------------------------------
style(ax_k, "|ψ(k)|²", "wavenumber  k")
kk = np.fft.fftshift(k)
def mom(p): return np.abs(np.fft.fftshift(np.fft.fft(p)))**2 * dx**2 / (2*np.pi)
kmax = mom(frames[0]).max() * 1.2
l_k, = ax_k.plot(kk, mom(frames[0]), color=VIOLET, lw=1.8)
fill_k = [ax_k.fill_between(kk, 0, mom(frames[0]), color=VIOLET, alpha=0.25)]
ax_k.axvline(0, color=GRID, lw=1)
ax_k.set_xlim(-4, 4); ax_k.set_ylim(0, kmax)
ax_k.set_title("Momentum space  (Fourier transform of ψ)", loc="left", fontsize=10, color=TXT, pad=6)
ax_k.text(0.02, 0.92, "← moving left      moving right →", transform=ax_k.transAxes, fontsize=7.5, color=DIM, va="top")

# ---- Bottom-right: probability bookkeeping --------------------------------
style(ax_p, "probability", "time  t")
ax_p.axhline(analytic_T(E0, V0, a), color=GREEN, ls=(0, (4, 3)), lw=1, alpha=0.8)
ax_p.text(T_END*0.99, analytic_T(E0, V0, a) + 0.02, "analytic T (single energy)", color=GREEN,
          fontsize=7, ha="right", va="bottom", alpha=0.9)
ln_L, = ax_p.plot([], [], color=BLUE,  lw=2, label="left of barrier")
ln_I, = ax_p.plot([], [], color=AMBER, lw=2, label="inside barrier")
ln_R, = ax_p.plot([], [], color=GREEN, lw=2, label="right (transmitted)")
ax_p.set_xlim(0, T_END); ax_p.set_ylim(0, 1.05)
ax_p.set_title("Where is the particle?", loc="left", fontsize=10, color=TXT, pad=6)
ax_p.legend(loc="center left", fontsize=7.5, frameon=False, labelcolor=TXT)
fill_p = []

# ============================================================================
# 4. DRAWING
# ============================================================================
ALPHA_GRAD = (0.32 + 0.68 * np.linspace(0, 1, 64)**0.6)[:, None, None]     # dim at base, bright at top

def draw(f):
    p, d = frames[f], prob(frames[f])
    ax_d.set_ylim(0, DMAX[f]); img.set_extent([x[0], x[-1], 0, DMAX[f]]); ax_d.set_xlim(*XLIM)
    ax_w.set_ylim(-WMAX[f], WMAX[f])
    l_re.set_ydata(p.real); l_im.set_ydata(p.imag)

    rgb = PHASE_CMAP((np.angle(p) + np.pi) / (2*np.pi))[:, :3]
    rgba = np.concatenate([np.broadcast_to(rgb, (64, N, 3)), np.broadcast_to(ALPHA_GRAD, (64, N, 1))], axis=2)
    img.set_data(rgba)
    poly.set_xy(np.vstack([[x[0], 0], np.column_stack([x, d]), [x[-1], 0]]))
    img.set_clip_path(poly)
    l_glow.set_ydata(d); l_edge.set_ydata(d)

    m = mom(p); l_k.set_ydata(m)
    fill_k[0].remove(); fill_k[0] = ax_k.fill_between(kk, 0, m, color=VIOLET, alpha=0.25)

    t = times[:f+1]
    ln_L.set_data(t, P_left[:f+1]); ln_I.set_data(t, P_in[:f+1]); ln_R.set_data(t, P_right[:f+1])
    for c in fill_p: c.remove()
    fill_p[:] = [ax_p.fill_between(t, 0, P_right[:f+1], color=GREEN, alpha=0.18),
                 ax_p.fill_between(t, 0, P_left[:f+1],  color=BLUE,  alpha=0.10)]

    txt_t.set_text(f"t = {times[f]:5.1f}")
    txt_T.set_text(f"transmitted  {P_right[f]*100:5.1f} %")
    txt_R.set_text(f"left side    {P_left[f]*100:5.1f} %")
    return ()

# ============================================================================
# 5. OUTPUT
# ============================================================================
if "--still" in sys.argv:
    draw(int(0.62 * n_frames))                      # a frame just after the collision
    fig.savefig("tunneling_still.png", dpi=160, facecolor=BG)
    print("saved tunneling_still.png")
elif "--save" in sys.argv:
    anim = FuncAnimation(fig, draw, frames=n_frames + 1, blit=False)
    anim.save("tunneling.gif", writer=PillowWriter(fps=24), dpi=75, savefig_kwargs={"facecolor": BG})
    print("saved tunneling.gif")
else:
    anim = FuncAnimation(fig, draw, frames=n_frames + 1, interval=40, blit=False, repeat=True)
    plt.show()