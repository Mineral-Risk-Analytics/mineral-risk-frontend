import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="ih-footer">
      <div className="ih-footer-inner">
        <div className="ih-footer-brand">
          <Image
            src="/hub/logo-mra-outline.svg"
            alt="Mineral Risk Analytics"
            width={36}
            height={40}
          />
          <div>
            <div className="ih-footer-wm">Mineral Risk Analytics</div>
            <div className="ih-footer-tag">Supply Chain Intelligence</div>
          </div>
        </div>

        <div className="ih-footer-cols">
          <div>
            <div className="ih-footer-h">Intelligence</div>
            <a href="#">Analysis</a>
            <a href="#">Signals</a>
            <a href="#">Reports</a>
            <a href="#">News</a>
          </div>
          <div>
            <div className="ih-footer-h">Pillars</div>
            <a href="#">Material Concentration</a>
            <a href="#">Geopolitical Trade</a>
            <a href="#">Regulatory Compliance</a>
            <a href="#">Operational</a>
          </div>
          <div>
            <div className="ih-footer-h">About</div>
            <Link href="/intelligence/methodology">Methodology</Link>
            <a href="#">Contact</a>
            <a href="#">Subscribe</a>
          </div>
        </div>
      </div>

      <div className="ih-footer-base">
        <span>© 2026 Mineral Risk Analytics</span>
        <span className="ih-mono">CN · DRC · CL · ID · AU</span>
      </div>
    </footer>
  );
}
