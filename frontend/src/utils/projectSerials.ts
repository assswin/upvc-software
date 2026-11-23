/**
 * Utility to generate and validate unique Project Serial Numbers.
 * Ensures zero duplicates across projects in LS INTERIORS.
 */

export function generateProjectSerialNumber(
  existingSerials: (string | undefined | null)[]
): string {
  const existingNums = new Set<number>();
  for (const s of existingSerials) {
    if (s && typeof s === 'string') {
      const match = s.trim().toUpperCase().match(/(?:PROJ|PRJ)?[-_ ]*(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          existingNums.add(num);
        }
      }
    }
  }

  let next = 1;
  while (existingNums.has(next)) {
    next++;
  }

  return `PROJ-${next}`;
}

/**
 * Flexible matcher for project ID / serial number in search bars.
 * Matches: 'proj-1', 'PROJ-1', 'proj 1', 'proj1', '1', 'prj-1', etc.
 */
export function matchesProjectSerial(
  serial: string | undefined | null,
  query: string
): boolean {
  if (!serial || !query) return false;
  const s = serial.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (s.includes(q)) return true;

  const sClean = s.replace(/[^a-z0-9]/g, '');
  const qClean = q.replace(/[^a-z0-9]/g, '');
  if (sClean && qClean && (sClean.includes(qClean) || qClean.includes(sClean))) {
    return true;
  }

  // Pure number search (e.g. searching '1' finds 'PROJ-1')
  const numMatch = s.match(/\d+/);
  if (numMatch && numMatch[0] === qClean) {
    return true;
  }

  return false;
}

/**
 * Checks whether an order name already exists for the given customer.
 * Returns true if a duplicate exists, false otherwise.
 */
export function isDuplicateOrderName(
  customerName: string,
  projectName: string,
  currentOrderId: string | null | undefined,
  savedOrders: { id: string; customerName: string; projectName: string }[]
): boolean {
  const normCustomer = customerName.trim().toLowerCase();
  const normProject = projectName.trim().toLowerCase();

  if (!normCustomer || !normProject) return false;

  return savedOrders.some((order) => {
    if (currentOrderId && order.id === currentOrderId) {
      return false;
    }
    return (
      order.customerName.trim().toLowerCase() === normCustomer &&
      order.projectName.trim().toLowerCase() === normProject
    );
  });
}
