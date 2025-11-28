import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  private api = 'http://localhost:5001/api/transaction';

  constructor(private http: HttpClient) {}

  // Create a new transaction
  createTransaction(data: any): Observable<any> {
    return this.http.post(this.api, data, {
      withCredentials: true
    });
  }

  // Get user’s own transactions
  getMyTransactions(): Observable<any> {
    return this.http.get(this.api, {
      withCredentials: true
    });
  }

  // Update a transaction (optional)
  updateTransaction(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.api}/${id}`, data, {
      withCredentials: true
    });
  }

  // Delete a transaction (optional)
  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.api}/${id}`, {
      withCredentials: true
    });
  }
}
