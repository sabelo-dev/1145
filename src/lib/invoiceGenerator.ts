import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface InvoiceProduct {
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface InvoiceData {
  orderId: string;
  orderDate: string;
  customerName: string;
  customerEmail?: string;
  shippingAddress: {
    name?: string;
    street?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
  };
  products: InvoiceProduct[];
  total: number;
  trackingNumber?: string;
  courierCompany?: string;
  estimatedDelivery?: string;
  storeName: string;
  orderStatus?: string;
}

export const generateInvoice = (data: InvoiceData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Colors
  const primaryColor: [number, number, number] = [245, 158, 11]; // Amber
  const darkColor: [number, number, number] = [31, 41, 55];
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [249, 250, 251];

  // Header Background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Logo / Brand
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("1145", 20, 25);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("LIFESTYLE", 20, 33);

  // Invoice Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 20, 25, { align: "right" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${data.orderId.slice(0, 8).toUpperCase()}`, pageWidth - 20, 33, { align: "right" });

  // Invoice Details Box
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, 52, pageWidth - 28, 28, 3, 3, "F");

  doc.setTextColor(...darkColor);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Date", 22, 62);
  doc.text("Order Status", 70, 62);
  doc.text("Payment Method", 118, 62);
  doc.text("Invoice Total", 166, 62);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(format(new Date(data.orderDate), "dd MMM yyyy"), 22, 72);
  doc.text(data.orderStatus?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Completed", 70, 72);
  doc.text("Online Payment", 118, 72);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text(`R${data.total.toFixed(2)}`, 166, 72);

  // Bill To & Ship To Section
  const sectionY = 90;
  
  // Bill To
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 20, sectionY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(data.customerName || "Customer", 20, sectionY + 8);
  if (data.customerEmail) {
    doc.text(data.customerEmail, 20, sectionY + 15);
  }

  // Ship To
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SHIP TO", 110, sectionY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  
  const address = data.shippingAddress || {};
  let shipY = sectionY + 8;
  if (address.name) {
    doc.text(address.name, 110, shipY);
    shipY += 6;
  }
  if (address.street) {
    doc.text(address.street, 110, shipY);
    shipY += 6;
  }
  const cityLine = [address.city, address.province, address.postal_code].filter(Boolean).join(", ");
  if (cityLine) {
    doc.text(cityLine, 110, shipY);
    shipY += 6;
  }
  if (address.country) {
    doc.text(address.country, 110, shipY);
    shipY += 6;
  }
  if (address.phone) {
    doc.text(`Tel: ${address.phone}`, 110, shipY);
  }

  // Tracking Info (if available)
  if (data.trackingNumber || data.courierCompany) {
    const trackingY = sectionY + 40;
    doc.setFillColor(...lightGray);
    doc.roundedRect(14, trackingY - 5, pageWidth - 28, 18, 2, 2, "F");
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    
    let trackX = 22;
    if (data.trackingNumber) {
      doc.text("Tracking Number:", trackX, trackingY + 4);
      doc.setFont("helvetica", "normal");
      doc.text(data.trackingNumber, trackX + 35, trackingY + 4);
      trackX += 80;
    }
    
    if (data.courierCompany) {
      doc.setFont("helvetica", "bold");
      doc.text("Courier:", trackX, trackingY + 4);
      doc.setFont("helvetica", "normal");
      doc.text(data.courierCompany, trackX + 18, trackingY + 4);
    }
  }

  // Products Table
  const tableStartY = data.trackingNumber || data.courierCompany ? 155 : 140;
  
  const tableData = data.products.map((product, index) => [
    (index + 1).toString(),
    product.name,
    product.quantity.toString(),
    `R${product.price.toFixed(2)}`,
    `R${(product.price * product.quantity).toFixed(2)}`,
  ]);

  // Calculate subtotal and VAT
  const subtotal = data.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const vat = data.total - subtotal > 0 ? data.total - subtotal : subtotal * 0.15;
  const shipping = data.total - subtotal - vat > 0 ? data.total - subtotal - vat : 0;

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Product Description", "Qty", "Unit Price", "Amount"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: [...primaryColor] as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [...lightGray] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50;
  const summaryX = pageWidth - 80;
  const summaryWidth = 66;

  doc.setFillColor(...lightGray);
  doc.roundedRect(summaryX - 5, finalY + 5, summaryWidth + 10, 45, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.setFont("helvetica", "normal");
  
  doc.text("Subtotal:", summaryX, finalY + 16);
  doc.text(`R${subtotal.toFixed(2)}`, summaryX + summaryWidth, finalY + 16, { align: "right" });
  
  doc.text("VAT (15%):", summaryX, finalY + 25);
  doc.text(`R${vat.toFixed(2)}`, summaryX + summaryWidth, finalY + 25, { align: "right" });
  
  doc.text("Shipping:", summaryX, finalY + 34);
  doc.text(shipping > 0 ? `R${shipping.toFixed(2)}` : "Included", summaryX + summaryWidth, finalY + 34, { align: "right" });

  // Total line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(summaryX - 2, finalY + 38, summaryX + summaryWidth + 2, finalY + 38);

  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", summaryX, finalY + 47);
  doc.setTextColor(...primaryColor);
  doc.text(`R${data.total.toFixed(2)}`, summaryX + summaryWidth, finalY + 47, { align: "right" });

  // Vendor info
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.setFont("helvetica", "normal");
  doc.text(`Sold by: ${data.storeName}`, 20, finalY + 20);

  // Footer
  const footerY = doc.internal.pageSize.height - 25;
  
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text("Thank you for shopping with 1145 Lifestyle!", pageWidth / 2, footerY + 2, { align: "center" });
  doc.setFontSize(8);
  doc.text("For questions about this invoice, please contact support@1145lifestyle.co.za", pageWidth / 2, footerY + 9, { align: "center" });
  doc.text(`Generated on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}`, pageWidth / 2, footerY + 15, { align: "center" });

  // Save
  doc.save(`invoice-${data.orderId.slice(0, 8).toUpperCase()}.pdf`);
};

export default generateInvoice;
