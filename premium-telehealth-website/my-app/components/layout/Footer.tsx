import Link from "next/link";
import { footerLinks, siteConfig } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-gray-50">
      <div className="py-16 px-4 sm:px-6 lg:px-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              {siteConfig.name}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Physician-prescribed treatment for alcohol use disorder and weight management.
            </p>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-ocean-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-ocean-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-ocean-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 py-6 px-4 sm:px-6 lg:px-20">
        <div className="flex flex-col items-center justify-center space-y-2 text-center sm:flex-row sm:justify-between sm:space-y-0">
          <p className="text-[13px] text-gray-500">
            © 2026 {siteConfig.name} | {siteConfig.license}
          </p>
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-[13px] text-gray-500 hover:text-ocean-500 transition-colors"
          >
            {siteConfig.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
