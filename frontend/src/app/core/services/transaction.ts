import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  private api = 'http://localhost:5001/api/transaction';

  constructor(private http: HttpClient) {}

  getMyTransactions(): Observable<any> {
    return this.http.get(`${this.api}`, { withCredentials: true });
  }
}
